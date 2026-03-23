// src/app/api/entitlements/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromSession } from "@/lib/auth";
import { computeEntitlementsEpochForUser } from "@/lib/entitlements-version-cache";
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

type PlanKey = "free" | "master" | "premium";

/**
 * Fallback features par plan (utile en DEV/E2E si DB pas migrée/seedée)
 * Ajuste si tu as d’autres features.
 */
const PLAN_FEATURES: Record<PlanKey, string[]> = {
  free: [],
  master: ["messages.unlimited", "contacts.view"],
  premium: ["messages.unlimited", "contacts.view", "chat.media", "suggestions.unlimited", "whatsapp.handoff", "boosts.buy"],
};

function normalizePlanKey(v: string | null | undefined): PlanKey | null {
  const s = String(v || "").toLowerCase().trim();
  if (s === "free" || s === "master" || s === "premium") return s;
  return null;
}

export async function GET(req: NextRequest) {
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

  // --- Plan cookie (dev/e2e) ---
  const planCookie = normalizePlanKey(req.cookies.get("plan")?.value);

  // 1) Entitlements user (direct grants)
  let entitlements: Array<{ feature_key: string; starts_at: Date; expires_at: Date | null }> = [];
  try {
    entitlements = await prisma.userEntitlement.findMany({
      where: { user_id: userId },
      select: {
        feature_key: true,
        starts_at: true,
        expires_at: true,
      },
    });
  } catch {
    // DB pas prête (tables non migrées) => fallback cookie plan
    entitlements = [];
  }

  const activeEntitlements = entitlements.filter((ent) => isEntitlementActive(ent, now));
  const directFeatures = activeEntitlements.map((e) => String(e.feature_key));

  // 2) Plan courant via subscription active-like (si DB OK), sinon cookie plan, sinon free
  let planKey: PlanKey = planCookie ?? "free";

  try {
    const activeSub = await prisma.subscription.findFirst({
      where: {
        user_id: userId,
        status: { in: ["active", "trialing", "past_due"] },
      },
      orderBy: { created_at: "desc" },
      select: { plan_key: true },
    });

    const dbPlan = normalizePlanKey(activeSub?.plan_key ?? null);
    if (dbPlan) planKey = dbPlan;
  } catch {
    // ignore, on garde le fallback cookie/free
  }

  // 2bis) Résoudre plan (DB si possible, sinon fallback)
  let planFromDb: { key: string; name: string; active: boolean } | null = null;

  try {
    planFromDb = await prisma.plan.findUnique({
      where: { key: planKey },
      select: { key: true, name: true, active: true },
    });
  } catch {
    planFromDb = null;
  }

  const plan =
    planFromDb != null
      ? { key: planFromDb.key, name: planFromDb.name, active: planFromDb.active }
      : planKey === "master"
        ? { key: "master", name: "Master", active: true }
        : planKey === "premium"
          ? { key: "premium", name: "Premium", active: true }
          : { key: "free", name: "Free", active: true };

  // 2ter) Features finales = direct + features plan fallback
  const planFeatures = PLAN_FEATURES[planKey] ?? [];
  const features = Array.from(new Set([...planFeatures, ...directFeatures]));

  // 2quater) `ev` : même source que la validation bearer (`getEntitlementsVersionCached`)
  const ev = await computeEntitlementsEpochForUser(userId);
  if (ev === null) {
    return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
  }

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
    ev,
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
