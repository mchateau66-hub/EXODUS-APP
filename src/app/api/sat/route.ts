// src/app/api/sat/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromSession } from "@/lib/auth";
import { requireJson, requireSameOrigin } from "@/lib/security";
import { limit, rateHeaders } from "@/lib/ratelimit";
import { issueSAT, normalizeSatPath } from "@/lib/sat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: any, init: ResponseInit = {}) {
  const h = new Headers(init.headers);
  if (!h.has("cache-control")) h.set("cache-control", "no-store");
  h.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers: h });
}

function makeDefaultSatResponse() {
  return {
    pro: false,
    status: "NONE",
    planKey: null as string | null,
    planName: null as string | null,
    expiresAt: null as Date | string | null,
    trialEndAt: null as Date | string | null,
  };
}

type SatIssueBody = { feature?: unknown; method?: unknown; path?: unknown };

function normStr(x: unknown) {
  return typeof x === "string" ? x.trim() : "";
}

function isHttpMethod(m: string) {
  return ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(m);
}

function isEntitlementActive(ent: { starts_at: Date; expires_at: Date | null }, now: Date) {
  if (ent.starts_at > now) return false;
  if (ent.expires_at && ent.expires_at <= now) return false;
  return true;
}

function noStore(headers?: HeadersInit) {
  const h = new Headers(headers);
  h.set("cache-control", "no-store");
  return h;
}

function envBool(name: string) {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let userId = searchParams.get("userId");

    if (!userId) {
      const sessionCtx = await getUserFromSession().catch(() => null);
      if ((sessionCtx as any)?.user?.id) userId = (sessionCtx as any).user.id;
    }

    if (!userId) {
      return json(makeDefaultSatResponse(), { status: 200, headers: noStore() });
    }

    const entitlement = await prisma.userEntitlement.findFirst({
      where: { user_id: userId },
      include: { subscription: { include: { plan: true } } },
      orderBy: { created_at: "desc" },
    });

    if (!entitlement || !entitlement.subscription) {
      return json(makeDefaultSatResponse(), { status: 200, headers: noStore() });
    }

    const sub = entitlement.subscription;

    return json(
      {
        pro: sub.status === "active",
        status: sub.status,
        planKey: sub.plan_key,
        planName: sub.plan?.name ?? null,
        expiresAt: sub.expires_at ?? null,
        trialEndAt: sub.trial_end_at ?? null,
      },
      { status: 200, headers: noStore() },
    );
  } catch (error) {
    console.error("Error in GET /api/sat", error);
    return json({ error: "Internal server error" }, { status: 500, headers: noStore() });
  }
}

export async function POST(req: NextRequest) {
  const csrf = requireSameOrigin(req);
  if (csrf) return new Response(csrf.body, { status: csrf.status, headers: noStore(csrf.headers) }) as any;

  const jsonOnly = requireJson(req);
  if (jsonOnly) return new Response(jsonOnly.body, { status: jsonOnly.status, headers: noStore(jsonOnly.headers) }) as any;

  const session = await getUserFromSession().catch(() => null);
  const user = (session as any)?.user;

  if (!user?.id) {
    return json({ ok: false, error: "unauthorized" }, { status: 401, headers: noStore() });
  }

  const isProd = process.env.NODE_ENV === "production";
  const forceRateLimit = envBool("E2E_FORCE_SAT_RATELIMIT");
  const inCI = envBool("CI");

  // ✅ Nouveau: E2E auto (Playwright / tests) => rate-limit ON
  const isE2E = req.headers.get("x-e2e") === "1";

  const enableRateLimit = isProd || inCI || forceRateLimit || isE2E;

  let body: SatIssueBody = {};
  try {
    body = (await req.json()) as SatIssueBody;
  } catch {
    body = {};
  }

  const feature = normStr(body.feature);
  const method = normStr(body.method).toUpperCase();
  const path = normalizeSatPath(normStr(body.path));

  let rlHeaders = noStore();
  if (enableRateLimit) {
    const limitN = parseInt(process.env.RATELIMIT_SAT_LIMIT || "20", 10);
    const windowS = parseInt(process.env.RATELIMIT_SAT_WINDOW_S || "60", 10);

    const key = `${String(user.id)}:${feature || "unknown"}`;
    const rl = await limit("sat", key, limitN > 0 ? limitN : 20, Math.max(1, windowS) * 1000);

    rlHeaders = rateHeaders(rl);
    rlHeaders.set("cache-control", "no-store");

    if (!rl.ok) {
      return json({ ok: false, error: "rate_limited" }, { status: 429, headers: rlHeaders });
    }
  }

  if (!feature) return json({ ok: false, error: "missing_feature" }, { status: 400, headers: rlHeaders });
  if (!method || !isHttpMethod(method)) return json({ ok: false, error: "invalid_method" }, { status: 400, headers: rlHeaders });
  if (!path) return json({ ok: false, error: "invalid_path" }, { status: 400, headers: rlHeaders });

  const known = new Set(["chat.send", "chat.media", "contacts.view", "whatsapp.handoff"]);
  if (!known.has(feature)) {
    return json({ ok: false, error: "unknown_feature" }, { status: 400, headers: rlHeaders });
  }

  const premiumGated = new Set(["contacts.view", "whatsapp.handoff", "chat.media"]);
  if (isProd && premiumGated.has(feature)) {
    const now = new Date();
    const entitlements = await prisma.userEntitlement.findMany({
      where: { user_id: String(user.id) },
      select: { feature_key: true, starts_at: true, expires_at: true },
    });

    const active = entitlements.filter((e) => isEntitlementActive(e, now));
    const features = new Set(active.map((e) => String(e.feature_key)));

    if (!features.has(feature)) {
      return json({ ok: false, error: "not_entitled", feature }, { status: 403, headers: rlHeaders });
    }
  }

  try {
    const { token, expMs } = await issueSAT({ userId: String(user.id), feature, method, path });
    return json({ ok: true, token, exp: expMs }, { status: 200, headers: rlHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server_error";
    return json({ ok: false, error: msg }, { status: 500, headers: rlHeaders });
  }
}
