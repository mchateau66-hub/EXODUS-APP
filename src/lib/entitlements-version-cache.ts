import { prisma } from "@/lib/db";

type CacheEntry = {
  ev: number | null;
  expiresAt: number;
};

const TTL_MS = 5_000;
const cache = new Map<string, CacheEntry>();

export function clearEntitlementsVersionCache(userId?: string) {
  if (userId) {
    cache.delete(userId);
    return;
  }

  cache.clear();
}

export async function getEntitlementsVersionCached(userId: string): Promise<number | null> {
  const now = Date.now();
  const cached = cache.get(userId);

  if (cached && cached.expiresAt > now) {
    return cached.ev;
  }

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { entitlements_version: true },
  });

  const ev = row?.entitlements_version ?? null;

  cache.set(userId, {
    ev,
    expiresAt: now + TTL_MS,
  });

  return ev;
}