// src/app/api/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { CoachAthleteStatus, Message, Prisma } from "@prisma/client";
import {
  userHasUnlimitedMessages,
  coachHasUnlimitedAthletes,
  coachHasExternalAppLink,
} from "@/server/features";
import {
  isCoachVerified,
  normalizeCoachVerificationStatus,
  type CoachVerificationStatus,
} from "@/lib/coachVerification";
import { requireJson, requireSameOrigin } from "@/lib/security";
import { limit, rateHeaders } from "@/lib/ratelimit";
import { consumeSAT } from "@/lib/sat";

// --------- Types ---------

type MessagesUsageInfo = { limit?: number | null; remaining?: number | null; unlimited?: boolean };
type MessagesQuotaMeta = {
  hasUnlimited: boolean;
  dailyLimit: number | null;
  usedToday: number | null;
  remainingToday: number | null;
};

type MessagesGetCoachNotFoundResponse = {
  ok: true;
  messages: [];
  usage: MessagesUsageInfo | null;
  meta: MessagesQuotaMeta | null;
  whatsapp: null;
  error: "coach_not_found";
};
type MessagesGetSuccessResponse = {
  ok: true;
  messages: Message[];
  usage: MessagesUsageInfo | null;
  meta: MessagesQuotaMeta | null;
  whatsapp: string | null;
};
type MessagesGetErrorResponse = { ok: false; error: "invalid_session" | "server_error" };
type MessagesGetResponse =
  | MessagesGetSuccessResponse
  | MessagesGetCoachNotFoundResponse
  | MessagesGetErrorResponse;

type MessagesPostSuccessResponse = {
  ok: true;
  message: Message;
  usage: MessagesUsageInfo | null;
  meta: MessagesQuotaMeta | null;
};

type MessagesPostErrorCode =
  | "invalid_session"
  | "missing_content"
  | "coach_not_found"
  | "coach_not_verified"
  | "coach_athletes_limit"
  | "quota_exceeded"
  | "sat_required"
  | "sat_user_mismatch"
  | "sat_invalid"
  | "sat_mismatch"
  | "sat_feature_forbidden"
  | "sat_replay_or_expired"
  | "rate_limited"
  | "server_error";

type MessagesPostErrorScope = "daily";

type MessagesPostErrorResponse = {
  ok: false;
  error: MessagesPostErrorCode;
  limit?: number;
  scope?: MessagesPostErrorScope;
  usage?: MessagesUsageInfo;
  meta?: MessagesQuotaMeta | null;
};

type MessagesPostResponse = MessagesPostSuccessResponse | MessagesPostErrorResponse;

// Compat E2E: certains tests utilisent `text` au lieu de `content`
type MessagesPostRequestBody = { content?: string; text?: string; coachId?: string };

// --------- Session helpers ---------

type SessionUserRole = "athlete" | "coach" | "admin";
interface SessionUser {
  id: string;
  role: SessionUserRole;
}

function isSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== "object") return false;
  const maybe = value as { id?: unknown; role?: unknown };
  if (typeof maybe.id !== "string" || typeof maybe.role !== "string") return false;
  return maybe.role === "athlete" || maybe.role === "coach" || maybe.role === "admin";
}

async function getSessionUser(): Promise<SessionUser | null> {
  const rawSession: unknown = await getUserFromSession();
  if (!rawSession || typeof rawSession !== "object") return null;
  if (!("user" in rawSession)) return null;
  const maybeUser = (rawSession as { user?: unknown }).user;
  if (!isSessionUser(maybeUser)) return null;
  return maybeUser;
}

async function parseJsonBody<T>(req: NextRequest): Promise<T | null> {
  try {
    const raw: unknown = await req.json();
    if (!raw || typeof raw !== "object") return null;
    return raw as T;
  } catch {
    return null;
  }
}

// --- Anti-contournement FREE (inchangé) ---
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_REGEX = /(\+?\d[\d .\-()]{6,}\d)/g;
const URL_REGEX =
  /((?:https?:\/\/|www\.)\S+|\b[a-z0-9.-]+\.(?:com|fr|net|io|gg|me|org|app|co|live|tv)\S*)/gi;
const AT_HANDLE_REGEX = /(^|\s)@([a-z0-9_.-]{3,})\b/gi;
const DISCORD_TAG_REGEX = /\b([a-z0-9_.]{3,})#\d{4}\b/gi;

const SOCIAL_WORDS =
  "(?:instagram|insta|ig|snapchat|snap|facebook|fb|tiktok|tt|telegram|signal|whatsapp|wa|discord|dc|linkedin|x|twitter|reddit|messenger|skype)";
const HANDLE_CONTEXT_WORDS = "(?:pseudo|identifiant|username|user|handle|profil|compte|contact|id)";
const SOCIAL_CONTEXT_REGEX = new RegExp(`\\b${SOCIAL_WORDS}\\b([^\\n\\r]{0,50})`, "gi");
const HANDLE_CONTEXT_REGEX = new RegExp(`\\b${HANDLE_CONTEXT_WORDS}\\b([^\\n\\r]{0,50})`, "gi");

const COACH_WHATSAPP_LINKS: Record<string, string | undefined> = {
  marie: process.env.COACH_MARIE_WHATSAPP_LINK,
  lucas: process.env.COACH_LUCAS_WHATSAPP_LINK,
};

function maskHandleInContext(full: string, contextPart: string): string {
  const context = String(contextPart ?? "");
  const handleMatch = context.match(/@?[a-z0-9_.-]{3,}/i);
  if (!handleMatch) return full;
  const handle = handleMatch[0];
  return full.replace(handle, "[pseudo masqué]");
}

function sanitizeMessageForFreePlan(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();

  if (/^[a-z0-9][a-z0-9_.-]{4,}[a-z0-9]$/i.test(trimmed)) {
    return "[pseudo masqué]";
  }

  let text = raw;
  text = text.replace(EMAIL_REGEX, "[email masqué]");
  text = text.replace(PHONE_REGEX, "[téléphone masqué]");
  text = text.replace(URL_REGEX, "[lien masqué]");
  text = text.replace(SOCIAL_CONTEXT_REGEX, (full: string, ctx: string) => maskHandleInContext(full, ctx));
  text = text.replace(HANDLE_CONTEXT_REGEX, (full: string, ctx: string) => maskHandleInContext(full, ctx));
  text = text.replace(AT_HANDLE_REGEX, (_full, space) => `${space}[pseudo masqué]`);
  text = text.replace(DISCORD_TAG_REGEX, "[pseudo masqué]");
  text = text.replace(/\b(?=[a-z0-9_.-]*[_\d.])[a-z0-9_.-]{5,}\b/gi, "[pseudo masqué]");
  text = text.replace(/\b[a-z0-9]{11,}\b/gi, "[pseudo masqué]");
  return text;
}
// --- fin anti-contournement ---

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FREE_DAILY_MESSAGES_LIMIT = (() => {
  const isProd = process.env.NODE_ENV === "production";

  // ✅ en dev/test/ci : on peut forcer un quota bas pour accélérer les E2E
  const raw = (!isProd ? process.env.E2E_FREE_DAILY_MESSAGES_LIMIT : undefined)
    ?? process.env.FREE_DAILY_MESSAGES_LIMIT
    ?? "20";

  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
})();

const COACH_FREE_ACTIVE_ATHLETES_LIMIT = (() => {
  const n = parseInt(process.env.COACH_FREE_ACTIVE_ATHLETES_LIMIT || "5", 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
})();

const ACTIVE_COACH_ATHLETE_STATUSES: CoachAthleteStatus[] = ["LEAD", "ACTIVE", "TO_FOLLOW"];

function getUtcDayStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * ✅ Mode quota:
 * - PROD (NODE_ENV=production): daily UTC
 * - Hors prod (dev/test/ci): GLOBAL (pour coller aux seeds e2e et éviter les flakiness)
 */
function isGlobalQuotaMode() {
  return process.env.NODE_ENV !== "production";
}

function quotaWindowWhere(now: Date) {
  return isGlobalQuotaMode() ? {} : { created_at: { gte: getUtcDayStart(now) } };
}

/**
 * IMPORTANT: quota FREE = par user / "fenêtre quota"
 * (pas de filtre coach)
 */
async function computeQuota(
  userId: string,
  now: Date,
  hasUnlimited: boolean,
  preCount?: number | null,
): Promise<{ usage: MessagesUsageInfo; meta: MessagesQuotaMeta; used: number | null }> {
  if (hasUnlimited) {
    return {
      usage: { unlimited: true, limit: null, remaining: null },
      meta: { hasUnlimited: true, dailyLimit: null, usedToday: null, remainingToday: null },
      used: null,
    };
  }

  const used =
    typeof preCount === "number"
      ? preCount
      : await prisma.message.count({
          where: { user_id: userId, ...quotaWindowWhere(now) },
        });

  const remaining = Math.max(0, FREE_DAILY_MESSAGES_LIMIT - used);

  return {
    usage: { unlimited: false, limit: FREE_DAILY_MESSAGES_LIMIT, remaining },
    meta: { hasUnlimited: false, dailyLimit: FREE_DAILY_MESSAGES_LIMIT, usedToday: used, remainingToday: remaining },
    used,
  };
}

function computeCoachVerificationStatus(statuses: string[]): CoachVerificationStatus {
  if (!statuses || statuses.length === 0) return "missing";
  const normalized = statuses.map((s) => normalizeCoachVerificationStatus(s));
  if (normalized.includes("rejected")) return "rejected";
  if (normalized.includes("needs_review")) return "needs_review";
  if (normalized.every((s) => s === "verified")) return "verified";
  if (normalized.includes("missing")) return "missing";
  return "unknown";
}

// --------- GET ---------

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "invalid_session" } satisfies MessagesGetErrorResponse,
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const userId = user.id;

  try {
    const url = new URL(req.url);
    const coachSlug = url.searchParams.get("coachId")?.toLowerCase() ?? null;

    const where: Prisma.MessageWhereInput = { user_id: userId };
    let coach: { id: string; user_id: string | null } | null = null;

    if (coachSlug) {
      coach = await prisma.coach.findUnique({
        where: { slug: coachSlug },
        select: { id: true, user_id: true },
      });

      if (!coach) {
        const response: MessagesGetCoachNotFoundResponse = {
          ok: true,
          messages: [],
          usage: null,
          meta: null,
          error: "coach_not_found",
          whatsapp: null,
        };
        return NextResponse.json(response, { status: 200, headers: { "cache-control": "no-store" } });
      }

      where.coach_id = coach.id;
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { created_at: "asc" },
      take: 100,
    });

    const now = new Date();
    const hasUnlimited = await userHasUnlimitedMessages(userId, now);
    const { usage, meta } = await computeQuota(userId, now, hasUnlimited);

    let whatsapp: string | null = null;
    if (hasUnlimited && coachSlug && coach) {
      const coachUserId = coach.user_id;
      if (coachUserId) {
        const coachCanExposeLink = await coachHasExternalAppLink(coachUserId, now);
        if (coachCanExposeLink) whatsapp = COACH_WHATSAPP_LINKS[coachSlug] ?? null;
      }
    }

    const response: MessagesGetResponse = { ok: true, messages, usage, meta, whatsapp };
    return NextResponse.json(response, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
    console.error("Error in GET /api/messages:", message);
    return NextResponse.json(
      { ok: false, error: "server_error" } satisfies MessagesGetErrorResponse,
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}

// --------- POST ---------

export async function POST(req: NextRequest) {
  // Signature d'instance (diagnostic)
  const sig = `messages-route pid=${process.pid} ts=${Date.now()} env=${process.env.NODE_ENV}`;

  // Injecte x-instance partout (y compris early returns)
  const withInstance = (headers?: HeadersInit) => {
    const h = new Headers(headers);
    h.set("cache-control", "no-store");
    h.set("x-instance", sig);
    return h;
  };

  const csrf = requireSameOrigin(req);
  if (csrf) return new Response(csrf.body, { status: csrf.status, headers: withInstance(csrf.headers) }) as any;

  const jsonOnly = requireJson(req);
  if (jsonOnly) return new Response(jsonOnly.body, { status: jsonOnly.status, headers: withInstance(jsonOnly.headers) }) as any;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "invalid_session" } satisfies MessagesPostErrorResponse, {
      status: 401,
      headers: withInstance(),
    });
  }

  const userId = user.id;

  // ✅ Rate limit: actif UNIQUEMENT en production (sinon ça casse les E2E)
  const isProd = process.env.NODE_ENV === "production";
  let rlH = withInstance(); // headers par défaut (no-store + x-instance)

  if (isProd) {
    const msgLimit = parseInt(process.env.RATELIMIT_MESSAGES_LIMIT || "30", 10);
    const msgWindowS = parseInt(process.env.RATELIMIT_MESSAGES_WINDOW_S || "60", 10);

    const rl = await limit(
      "messages",
      String(userId),
      msgLimit > 0 ? msgLimit : 30,
      (msgWindowS > 0 ? msgWindowS : 60) * 1000,
    );

    rlH = rateHeaders(rl);
    rlH.set("cache-control", "no-store");
    rlH.set("x-instance", sig);

    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: "rate_limited" } satisfies MessagesPostErrorResponse, {
        status: 429,
        headers: rlH,
      });
    }
  }

  const body = (await parseJsonBody<MessagesPostRequestBody>(req)) ?? {};
  const content = (body.content ?? body.text ?? "").trim();
  const coachSlug = body.coachId ? body.coachId.toLowerCase() : null;

  if (!content) {
    return NextResponse.json({ ok: false, error: "missing_content" } satisfies MessagesPostErrorResponse, {
      status: 400,
      headers: rlH,
    });
  }

  try {
    const now = new Date();

    // --- coach lookup / checks ---
    let coachIdForDb: string | null = null;
    let coachUserId: string | null = null;

    if (coachSlug) {
      const coach = await prisma.coach.findUnique({
        where: { slug: coachSlug },
        select: { id: true, user_id: true },
      });

      if (!coach) {
        return NextResponse.json({ ok: false, error: "coach_not_found" } satisfies MessagesPostErrorResponse, {
          status: 404,
          headers: rlH,
        });
      }

      coachIdForDb = coach.id;
      coachUserId = coach.user_id;

      if (user.role === "athlete") {
        const statuses = coachUserId
          ? (
              await prisma.coachDocument.findMany({
                where: { user_id: coachUserId },
                select: { status: true },
              })
            ).map((d) => String(d.status))
          : [];

        const verifyStatus = computeCoachVerificationStatus(statuses);
        if (!isCoachVerified(verifyStatus)) {
          return NextResponse.json({ ok: false, error: "coach_not_verified" } satisfies MessagesPostErrorResponse, {
            status: 403,
            headers: rlH,
          });
        }
      }

      if (user.role === "athlete") {
        const isCoachUnlimited = coachUserId ? await coachHasUnlimitedAthletes(coachUserId, now) : false;

        const existingRelation = await prisma.coachAthlete.findUnique({
          where: { coach_id_athlete_id: { coach_id: coach.id, athlete_id: userId } },
          select: { coach_id: true },
        });

        if (!existingRelation && !isCoachUnlimited) {
          const activeCount = await prisma.coachAthlete.count({
            where: { coach_id: coach.id, status: { in: ACTIVE_COACH_ATHLETE_STATUSES } },
          });

          if (activeCount >= COACH_FREE_ACTIVE_ATHLETES_LIMIT) {
            return NextResponse.json(
              { ok: false, error: "coach_athletes_limit", limit: COACH_FREE_ACTIVE_ATHLETES_LIMIT } satisfies MessagesPostErrorResponse,
              { status: 402, headers: rlH },
            );
          }
        }

        await prisma.coachAthlete.upsert({
          where: { coach_id_athlete_id: { coach_id: coach.id, athlete_id: userId } },
          update: { lastMessageAt: now },
          create: { coach_id: coach.id, athlete_id: userId, status: "LEAD", lastMessageAt: now },
        });
      }
    }

    // --- quota BEFORE SAT ---
    const hasUnlimited = await userHasUnlimitedMessages(userId, now);
    let usedBefore: number | null = null;

    if (!hasUnlimited) {
      const quota = await computeQuota(userId, now, false);
      usedBefore = quota.used ?? 0;

      if ((quota.used ?? 0) >= FREE_DAILY_MESSAGES_LIMIT) {
        const response: MessagesPostErrorResponse = {
          ok: false,
          error: "quota_exceeded",
          limit: FREE_DAILY_MESSAGES_LIMIT,
          scope: "daily",
          usage: quota.usage,
          meta: quota.meta,
        };
        return NextResponse.json(response, { status: 402, headers: rlH });
      }
    }

    // --- SAT AFTER quota ---
    const enforceSat = Boolean((process.env.SAT_JWT_SECRET || "").trim());
    if (enforceSat) {
      const satRes = await consumeSAT(req, { allowedFeatures: ["chat.media", "chat.send"] });

      if (!("ok" in (satRes as any)) || (satRes as any).ok !== true) {
        const r = satRes as Response;
        const data = await r.clone().json().catch(() => null);

        const code: MessagesPostErrorCode =
          data?.error === "sat_required" ||
          data?.error === "sat_invalid" ||
          data?.error === "sat_mismatch" ||
          data?.error === "sat_feature_forbidden" ||
          data?.error === "sat_replay_or_expired"
            ? (data.error as MessagesPostErrorCode)
            : "sat_invalid";

        return NextResponse.json({ ok: false, error: code } satisfies MessagesPostErrorResponse, {
          status: (r as any).status || 403,
          headers: rlH,
        });
      }

      const satPayload = (satRes as any).payload as { sub?: string };
      if (String(satPayload?.sub || "") !== String(userId)) {
        return NextResponse.json({ ok: false, error: "sat_user_mismatch" } satisfies MessagesPostErrorResponse, {
          status: 403,
          headers: rlH,
        });
      }
    }

    // --- create message ---
    const finalContent = hasUnlimited ? content : sanitizeMessageForFreePlan(content);

    const message = await prisma.message.create({
      data: { user_id: userId, content: finalContent, coach_id: coachIdForDb },
    });

    const usedAfter = hasUnlimited ? null : (usedBefore ?? 0) + 1;
    const { usage, meta } = await computeQuota(userId, now, hasUnlimited, usedAfter);

    const response: MessagesPostResponse = { ok: true, message, usage, meta };
    return NextResponse.json(response, { status: 200, headers: rlH });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
    console.error("Error in POST /api/messages:", message);

    return NextResponse.json({ ok: false, error: "server_error" } satisfies MessagesPostErrorResponse, {
      status: 500,
      headers: withInstance(rlH),
    });
  }
}
