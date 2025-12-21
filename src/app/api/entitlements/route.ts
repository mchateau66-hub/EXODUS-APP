// src/app/api/entitlements/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromSession } from "@/lib/auth";
import { signJWT } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Un entitlement est actif si :
 * - starts_at <= now
 * - et (expires_at est null OU expires_at > now)
 */
function isEntitlementActive(ent: { starts_at: Date; expires_at: Date | null }, now: Date) {
  if (ent.starts_at > now) return false;
  if (ent.expires_at && ent.expires_at <= now) return false;
  return true;
}

export async function GET(_req: NextRequest) {
  const session = await getUserFromSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { user, sid } = session;
  const userId = String((user as any).id || "");
  if (!userId) {
    return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401 });
  }

  const now = new Date();

  // 1) Entitlements user
  const entitlements = await prisma.userEntitlement.findMany({
    where: { user_id: userId },
    select: {
      feature_key: true,
      starts_at: true,
      expires_at: true,
    },
  });

  const activeEntitlements = entitlements.filter((ent) => isEntitlementActive(ent, now));
  const features = Array.from(new Set(activeEntitlements.map((e) => String(e.feature_key))));

  // 2) Plan courant via subscription active-like
  const activeSub = await prisma.subscription.findFirst({
    where: {
      user_id: userId,
      status: { in: ["active", "trialing", "past_due"] },
    },
    orderBy: { created_at: "desc" },
    select: { plan_key: true },
  });

  const planKey = activeSub?.plan_key ?? null;

  let planFromDb = planKey
    ? await prisma.plan.findUnique({ where: { key: planKey }, select: { key: true, name: true, active: true } })
    : null;

  if (!planFromDb) {
    planFromDb = await prisma.plan.findUnique({
      where: { key: "free" },
      select: { key: true, name: true, active: true },
    });
  }

  const plan =
    planFromDb != null
      ? { key: planFromDb.key, name: planFromDb.name, active: planFromDb.active }
      : { key: "free", name: "Free", active: true };

  // 3) Claim
  const iatSec = Math.floor(now.getTime() / 1000);
  const ttl = parseInt(process.env.ENTITLEMENTS_TTL_S || "300", 10);
  const ttlSec = Number.isFinite(ttl) && ttl > 0 ? ttl : 300;
  const expSec = iatSec + ttlSec;

  const claim = {
    sub: userId,
    plan,
    features,
    sid,
    device: "web",
    iat: iatSec,
    exp: expSec,
    jti: `${sid}-${iatSec}`,
    ver: 1,
  };

  // 4) (Optionnel) Token signé
  const secret = process.env.ENTITLEMENTS_JWT_SECRET || "";
  let token: string | null = null;

  if (secret) {
    try {
      token = await signJWT(claim as any, secret, ttlSec);
    } catch {
      token = null;
    }
  }

  return NextResponse.json(
    { ok: true, claim, token },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
