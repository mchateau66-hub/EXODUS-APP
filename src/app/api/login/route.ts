// src/app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  limitSeconds,
  rateKeyFromRequest,
  rateHeaders,
} from "@/lib/ratelimit";

type Plan = "free" | "master" | "premium";
type Role = "athlete" | "coach" | "admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function noStoreHeaders() {
  return {
    "cache-control": "no-store",
  };
}

function textNoStore(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...noStoreHeaders(),
    },
  });
}

function jsonNoStore(payload: any, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: noStoreHeaders(),
  });
}

function isE2E(req: NextRequest): boolean {
  return (req.headers.get("x-e2e") ?? "").trim() === "1";
}

function isLocalhost(req: NextRequest): boolean {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

function isHttps(req: NextRequest): boolean {
  return (
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https" ||
    req.nextUrl.protocol === "https:"
  );
}

function isProdLike() {
  const vercelEnv = (process.env.VERCEL_ENV ?? "").trim();
  return (
    process.env.NODE_ENV === "production" ||
    vercelEnv === "production" ||
    vercelEnv === "preview"
  );
}

function tokenOk(req: NextRequest): boolean {
  const expected = (process.env.E2E_DEV_LOGIN_TOKEN ?? "").trim();

  if (isProdLike() && !expected) return false;
  if (!expected) return true;
  if (!isProdLike() && isLocalhost(req)) return true;

  const got = (req.headers.get("x-e2e-token") ?? "").trim();
  if (!got) return false;

  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

function devLoginEnabled(req: NextRequest) {
  if (!isProdLike()) return true;
  if (!isE2E(req)) return false;
  return tokenOk(req);
}

function pickPlan(v: unknown): Plan {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "pro") return "premium";
  return s === "master" || s === "premium" ? (s as Plan) : "free";
}

function pickRole(v: unknown): Role {
  const s = String(v ?? "").toLowerCase().trim();
  return s === "coach" || s === "admin" ? (s as Role) : "athlete";
}

function serializeErr(err: unknown) {
  const e = err as any;
  return {
    name: String(e?.name ?? "Error"),
    message: String(e?.message ?? "").slice(0, 1000),
  };
}

/* -------------------------------------------------------------------------- */
/*                                   Schema                                   */
/* -------------------------------------------------------------------------- */

const BodySchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(["athlete", "coach", "admin"]).optional(),
  plan: z.enum(["free", "master", "premium", "pro"]).optional(),
  maxAgeSeconds: z.number().int().positive().max(60 * 60 * 24 * 7).optional(),
  maxAge: z.number().int().positive().max(60 * 60 * 24 * 7).optional(),
});

/* -------------------------------------------------------------------------- */
/*                          Fallback Prisma Session                           */
/* -------------------------------------------------------------------------- */

async function fallbackCreateSessionAndCookies(
  req: NextRequest,
  userId: string,
  plan: Plan,
) {
  const p: any = prisma as any;

  const models = [
    p.session,
    p.sessions,
    p.userSession,
    p.userSessions,
    p.authSession,
    p.authSessions,
  ].filter(Boolean);

  if (!models.length) {
    throw new Error("No session model found on prisma.");
  }

  const secure = isHttps(req);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 6);

  for (const m of models) {
    try {
      const created = await m.create({
        data: { user_id: userId, expires_at: expiresAt },
        select: { id: true },
      });

      const sid = String(created.id);

      const res = jsonNoStore({ ok: true, via: "fallback", sid, userId, plan });

      res.cookies.set("sid", sid, {
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
        maxAge: 60 * 60 * 6,
      });

      res.cookies.set("plan", plan, {
        httpOnly: false,
        sameSite: "lax",
        secure,
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });

      return res;
    } catch {}
  }

  throw new Error("Fallback session creation failed");
}

/* -------------------------------------------------------------------------- */
/*                                    POST                                    */
/* -------------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || randomUUID();

  try {
    if (!devLoginEnabled(req)) return textNoStore("Not found", 404);

    const len = Number(req.headers.get("content-length") || "0");
    if (len && len > 100_000) {
      return textNoStore("Payload too large", 413);
    }

    /* ------------------------------ Rate limit ------------------------------ */

    const ipKey = rateKeyFromRequest(req);
    const tokenFrag = (req.headers.get("x-e2e-token") ?? "").slice(0, 16);
    const rlKey = tokenFrag ? `${ipKey}:${tokenFrag}` : ipKey;

    const r = await limitSeconds("dev_login", rlKey, 20, 60);

    if (!r.ok) {
      return new Response("Too many requests", {
        status: 429,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          ...noStoreHeaders(),
          ...Object.fromEntries(rateHeaders(r).entries()),
        },
      });
    }

    /* ------------------------------ Body parse ------------------------------ */

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonNoStore({ ok: false, error: "invalid_body" }, 400);
    }

    const body = parsed.data;

    const email = String(body.email ?? "dev@local.test")
      .toLowerCase()
      .trim();

    const role = pickRole(body.role ?? "athlete");
    const plan = pickPlan(body.plan);

    const rawMaxAge = body.maxAgeSeconds ?? body.maxAge;
    const maxAgeSeconds =
      typeof rawMaxAge === "number" && Number.isFinite(rawMaxAge)
        ? Math.floor(rawMaxAge)
        : undefined;

    /* ------------------------------- Upsert user ---------------------------- */

    const nowIso = new Date().toISOString();

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role,
        onboardingStep: 3,
        onboardingStep1Answers: { e2e: true, at: nowIso },
        onboardingStep2Answers: { e2e: true, at: nowIso },
        country: "FR",
        language: "fr",
        status: "active",
      },
      create: {
        email,
        role,
        onboardingStep: 3,
        onboardingStep1Answers: { e2e: true, at: nowIso },
        onboardingStep2Answers: { e2e: true, at: nowIso },
        country: "FR",
        language: "fr",
        status: "active",
      },
      select: { id: true, email: true, role: true, onboardingStep: true },
    });

    /* -------------------------- Try official session ------------------------ */

    try {
      const mod: any = await import("@/lib/auth");
      const createSessionResponseForUser = mod?.createSessionResponseForUser;

      if (typeof createSessionResponseForUser !== "function") {
        throw new Error("createSessionResponseForUser missing");
      }

      const res: NextResponse =
        await createSessionResponseForUser(
          user.id,
          { ok: true, user, plan },
          req,
          maxAgeSeconds ? { maxAgeSeconds } : {},
        );

      res.headers.set("x-request-id", requestId);
      res.headers.set("cache-control", "no-store");

      for (const [k, v] of rateHeaders(r).entries()) {
        res.headers.set(k, v);
      }

      res.cookies.set("plan", plan, {
        httpOnly: false,
        sameSite: "lax",
        secure: isHttps(req),
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });

      res.headers.set("x-e2e-login", "1");
      return res;
    } catch (err) {
      console.error("[api/login] session fallback", {
        requestId,
        detail: serializeErr(err),
      });

      const res = await fallbackCreateSessionAndCookies(req, user.id, plan);
      res.headers.set("x-request-id", requestId);
      return res;
    }
  } catch (err) {
    console.error("[api/login] crash", {
      requestId,
      detail: serializeErr(err),
    });

    return jsonNoStore(
      { ok: false, error: "api_login_crash", requestId },
      500,
    );
  }
}