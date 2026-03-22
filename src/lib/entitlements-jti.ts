import type { EntitlementClaim } from "@/lib/entitlements-guard";
import { logSecurity } from "@/lib/security-log";
import { HttpError } from "@/lib/http-error";

function unauthorized(msg = "unauthorized"): never {
  throw new HttpError(401, msg, msg);
}

type MemEntry = { expMs: number };

/** Fallback mémoire (mono-process), aligné sur l’approche de `src/lib/sat.ts`. */
const mem = new Map<string, MemEntry>();

function memCleanup(now = Date.now()) {
  for (const [k, v] of mem.entries()) {
    if (v.expMs <= now) mem.delete(k);
  }
}

/**
 * Anti-replay : consomme un `jti` une seule fois.
 *
 * **Schéma Prisma** : il n’existe pas de table dédiée aux JWT entitlements.
 * - `sat_jti` sert aux SAT et impose `jti` en **UUID**, incompatible avec le format
 *   `${sid}-${iatSec}` produit par `/api/entitlements`.
 *
 * **Fallback** : registre mémoire par processus (pas d’anti-replay cross-instance).
 * Pour une persistance DB, il faudrait une migration Prisma dédiée (nouveau modèle).
 */
export async function consumeJtiOnce(claim: EntitlementClaim) {
  memCleanup();
  const key = claim.jti;
  const expMs = claim.exp * 1000;
  const existing = mem.get(key);
  if (existing) {
    logSecurity("replayed_token", { userId: claim.sub, jti: claim.jti });
    unauthorized("replayed_token");
  }
  mem.set(key, { expMs });
}
