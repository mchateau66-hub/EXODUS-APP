import { prisma } from "@/lib/db";

/**
 * Version des entitlements côté DB.
 *
 * Utilisé pour invalider les JWT entitlements (claim.ev) si les droits ont changé.
 * Best-effort cache mémoire (process-local) pour limiter les hits DB.
 */

type Entry = { v: number; expMs: number };
const mem = new Map<string, Entry>();

function ttlMs() {
  const raw = parseInt(process.env.ENTITLEMENTS_VERSION_CACHE_TTL_MS || "5000", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 5000;
}

export async function getEntitlementsVersionCached(userId: string): Promise<number | null> {
  const now = Date.now();
  const cached = mem.get(userId);
  if (cached && cached.expMs > now) return cached.v;

  const row = await prisma.user
    .findUnique({
      where: { id: userId },
      select: { entitlements_version: true },
    })
    .catch(() => null);

  const v = row?.entitlements_version;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;

  mem.set(userId, { v, expMs: now + ttlMs() });
  return v;
}

