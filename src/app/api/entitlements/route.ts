import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromSession } from "@/lib/auth";
import { signJWT } from "@/lib/jwt";
import { limitSeconds, rateHeaders, rateKeyFromRequest } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isEntitlementActive(
  ent: { starts_at: Date; expires_at: Date | null },
  now: Date,
) {
  if (ent.starts_at > now) return false;
  if (ent.expires_at && ent.expires_at <= now) return false;
  return true;
}

function jsonWithHeaders(
  body: unknown,
  init: ResponseInit = {},
  extraHeaders?: Headers,
) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");

  if (extraHeaders) {
    extraHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

export async function GET(req: NextRequest) {
  let session = await getUserFromSession().catch(() => null);

  const debugEnabled = process.env.ENTITLEMENTS_DEBUG === "1";
  const debugKey = process.env.ENTITLEMENTS_DEBUG_KEY || "";

  const hdrUserId = req.headers.get("x-user-id");
  const hdrDebugKey = req.headers.get("x-debug-key");

  // Bloc debug: autorise l'injection d'un user id en DEV uniquement
  if (hdrUserId) {
    if (process.env.NODE_ENV === "production") {
      return jsonWithHeaders({ ok: false, error: "forbidden" }, { status: 403 });
    }
    if (!debugEnabled) {
      return jsonWithHeaders({ ok: false, error: "debug_disabled" }, { status: 403 });
    }
    if (!debugKey || hdrDebugKey !== debugKey) {
      return jsonWithHeaders({ ok: false, error: "bad_debug_key" }, { status: 403 });
    }
  }

  // DEBUG LOCAL UNIQUEMENT: fallback si pas de session
  if (!session) {
    const debugUserId = req.headers.get("x-user-id");
    if (debugUserId) {
      session = {
        user: { id: debugUserId },
        sid: "debug-session",
      } as any;
    }
  }

  const sessionUserId = String((session as any)?.user?.id || "");
  const limitN = parseInt(process.env.RATELIMIT_ENTITLEMENTS_LIMIT || "30", 10);
  const windowS = parseInt(process.env.RATELIMIT_ENTITLEMENTS_WINDOW_S || "60", 10);

  const rlKey = rateKeyFromRequest(req, sessionUserId || undefined);
  const rl = await limitSeconds(
    "entitlements",
    rlKey,
    limitN > 0 ? limitN : 30,
    Math.max(1, windowS),
  );
  const rlHeaders = rateHeaders(rl);

  if (!rl.ok) {
    return jsonWithHeaders(
      { ok: false, error: "rate_limited" },
      { status: 429 },
      rlHeaders,
    );
  }

  if (!session) {
    return jsonWithHeaders(
      { ok: false, error: "unauthorized" },
      { status: 401 },
      rlHeaders,
    );
  }

  const { user, sid } = session;
  const userId = String((user as any).id || "");
  if (!userId) {
    return jsonWithHeaders(
      { ok: false, error: "invalid_session" },
      { status: 401 },
      rlHeaders,
    );
  }

  const now = new Date();

  // 0️⃣ Charge user.entitlements_version + role depuis la DB (source de vérité)
  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { entitlements_version: true, role: true },
  });

  const entitlementsVersion = userRow?.entitlements_version ?? 1;
  const role = userRow?.role ?? null;

  // 1️⃣ Plan via subscription active ou trialing UNIQUEMENT
  const activeSub = await prisma.subscription.findFirst({
    where: {
      user_id: userId,
      status: { in: ["active", "trialing"] },
    },
    orderBy: { updated_at: "desc" },
    select: { plan_key: true },
  });

  const planKey = activeSub?.plan_key ?? "free";

  const plan = await prisma.plan.findUnique({
    where: { key: planKey },
    select: { key: true, name: true, active: true },
  });

  const resolvedPlan = plan ?? { key: "free", name: "Free", active: true };

  // 2️⃣ Entitlements actifs (source de vérité = DB)
  const entitlements = await prisma.userEntitlement.findMany({
    where: { user_id: userId },
    select: {
      feature_key: true,
      starts_at: true,
      expires_at: true,
    },
  });

  const activeFeatures = entitlements
    .filter((ent) => isEntitlementActive(ent, now))
    .map((ent) => String(ent.feature_key));

  const features = Array.from(new Set(activeFeatures)).sort();

  // 3️⃣ Claim sécurisé (TTL ≤ 60s)
  const iatSec = Math.floor(now.getTime() / 1000);

  const ttlRaw = Number(process.env.ENTITLEMENTS_TOKEN_TTL_SECONDS ?? "60");
  const ttlSec = Math.min(Math.max(ttlRaw, 5), 60);

  const expSec = iatSec + ttlSec;

  const claim = {
    sub: userId,
    sid,
    ver: Number(process.env.ENTITLEMENTS_CLAIM_VER || 2),
    ev: entitlementsVersion,
    role,
    planKey: resolvedPlan.key,
    features,
    iat: iatSec,
    exp: expSec,
    jti: `${sid}-${iatSec}`,
  };

  // 4️⃣ JWT signé (HS256)
  const secret =
    process.env.ENTITLEMENTS_JWT_SECRET ||
    process.env.ENTITLEMENTS_TOKEN_SECRET ||
    "";

  let token: string | null = null;
  if (secret) {
    token = await signJWT(claim as any, secret, ttlSec);
  }

  return jsonWithHeaders(
    {
      ok: true,
      plan: resolvedPlan,
      features,
      claim,
      token,
      expiresAt: new Date(expSec * 1000).toISOString(),
    },
    { status: 200 },
    rlHeaders,
  );
}