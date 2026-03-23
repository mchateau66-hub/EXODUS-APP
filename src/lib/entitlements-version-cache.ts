import { prisma } from "@/lib/db";

/**
 * **Schéma Prisma** : le modèle `User` n’a pas de champ `entitlements_version`.
 *
 * On dérive un entier stable (`ev`) à partir de l’état réellement persisté :
 * abonnement actif (`Subscription.plan_key`) + entitlements directs actifs (`UserEntitlement`).
 *
 * **Contrat** : la route qui signe le JWT (`GET /api/entitlements`) doit inclure le même
 * `ev` dans le claim (via une fonction partagée ou le même calcul) pour que
 * `assertFreshEntitlementsVersion` accepte le token.
 */

type Entry = { v: number; expMs: number };
const mem = new Map<string, Entry>();

function ttlMs() {
  const raw = parseInt(process.env.ENTITLEMENTS_VERSION_CACHE_TTL_MS || "5000", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 5000;
}

function isEntitlementActive(
  ent: { starts_at: Date; expires_at: Date | null },
  now: Date,
): boolean {
  if (ent.starts_at > now) return false;
  if (ent.expires_at && ent.expires_at <= now) return false;
  return true;
}

/** FNV-1a 32-bit → entier non signé (stable, déterministe). */
function fnv1a32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Version « effective » des droits, dérivée uniquement de tables Prisma existantes.
 */
export async function computeEntitlementsEpochForUser(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) return null;

  const now = new Date();

  const ents = await prisma.userEntitlement.findMany({
    where: { user_id: userId },
    select: { feature_key: true, starts_at: true, expires_at: true },
  });
  const activeKeys = ents
    .filter((e) => isEntitlementActive(e, now))
    .map((e) => String(e.feature_key))
    .sort();

  const sub = await prisma.subscription.findFirst({
    where: {
      user_id: userId,
      status: { in: ["active", "trialing", "past_due"] },
    },
    orderBy: { created_at: "desc" },
    select: { plan_key: true },
  });

  const planKey = sub?.plan_key != null && String(sub.plan_key).length > 0 ? String(sub.plan_key) : "free";
  const fingerprint = `${planKey}|${activeKeys.join(",")}`;
  return fnv1a32(fingerprint);
}

export async function getEntitlementsVersionCached(userId: string): Promise<number | null> {
  const now = Date.now();
  const cached = mem.get(userId);
  if (cached && cached.expMs > now) return cached.v;

  const v = await computeEntitlementsEpochForUser(userId);
  if (v == null) return null;

  mem.set(userId, { v, expMs: now + ttlMs() });
  return v;
}
