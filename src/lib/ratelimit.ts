// src/lib/ratelimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasRedis = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

const redis = hasRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Fallback mémoire (dev / si Redis KO)
const mem = new Map<string, { count: number; reset: number; limit: number }>();
const MEM_MAX = 5_000;

export type RateResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number; // unix seconds
};

const rlCache = new Map<string, Ratelimit>();

function getLimiter(name: string, limitN: number, windowMs: number) {
  if (!redis) throw new Error("Redis not configured");

  const windowS = Math.max(1, Math.ceil(windowMs / 1000));
  const k = `${name}:${limitN}:${windowS}`;

  const existing = rlCache.get(k);
  if (existing) return existing;

  const created = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limitN, `${windowS} s`),
    analytics: false,
    prefix: `rl:${name}`,
  });

  rlCache.set(k, created);
  return created;
}

function memGcIfNeeded() {
  if (mem.size <= MEM_MAX) return;
  const toDelete = Math.ceil(MEM_MAX * 0.1);
  let i = 0;
  for (const k of mem.keys()) {
    mem.delete(k);
    i += 1;
    if (i >= toDelete) break;
  }
}

function memLimit(name: string, key: string, limitN: number, windowMs: number): RateResult {
  memGcIfNeeded();

  const now = Date.now();
  const k = `${name}:${key}:${limitN}:${windowMs}`;
  const entry = mem.get(k);

  if (!entry || entry.reset <= now) {
    mem.set(k, { count: 1, reset: now + windowMs, limit: limitN });
    return {
      ok: true,
      limit: limitN,
      remaining: limitN - 1,
      reset: Math.ceil((now + windowMs) / 1000),
    };
  }

  if (entry.count < entry.limit) {
    entry.count += 1;
    return {
      ok: true,
      limit: entry.limit,
      remaining: entry.limit - entry.count,
      reset: Math.ceil(entry.reset / 1000),
    };
  }

  return {
    ok: false,
    limit: entry.limit,
    remaining: 0,
    reset: Math.ceil(entry.reset / 1000),
  };
}

export async function limit(
  name: string,
  key: string,
  limitN: number,
  windowMs: number,
): Promise<RateResult> {
  if (!redis) return memLimit(name, key, limitN, windowMs);

  try {
    const rl = getLimiter(name, limitN, windowMs);
    const { success, reset, limit, remaining, pending } = await rl.limit(key);
    if (pending) await pending;

    return { ok: success, limit, remaining, reset: Math.ceil(Number(reset) / 1000) };
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("[ratelimit] redis error:", e);
    return memLimit(name, key, limitN, windowMs);
  }
}

// ✅ helper pratique (seconds)
export async function limitSeconds(
  name: string,
  key: string,
  limitN: number,
  windowSeconds: number,
): Promise<RateResult> {
  return limit(name, key, limitN, Math.max(1, windowSeconds) * 1000);
}

// ✅ helper clé stable (sans PII)
export function rateKeyFromRequest(req: { headers: Headers }, userId?: string) {
  const xf = req.headers.get("x-forwarded-for");
  const ip =
    (xf ? xf.split(",")[0].trim() : null) ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return userId ? `${userId}:${ip}` : ip;
}

// src/lib/ratelimit.ts
export function rateHeaders(r: RateResult) {
  const limit = String(r.limit);
  const remaining = String(r.remaining);
  const reset = String(r.reset);

  const h = new Headers({
    // "standard-ish"
    "RateLimit-Limit": limit,
    "RateLimit-Remaining": remaining,
    "RateLimit-Reset": reset,

    // compat (certaines stacks normalisent / filtrent)
    "ratelimit-limit": limit,
    "ratelimit-remaining": remaining,
    "ratelimit-reset": reset,
  });

  // Bonus pratique si 429 (pas obligatoire pour ton test)
  if (!r.ok) {
    const nowS = Math.ceil(Date.now() / 1000);
    const retryAfter = Math.max(0, r.reset - nowS);
    h.set("Retry-After", String(retryAfter));
  }

  return h;
}
