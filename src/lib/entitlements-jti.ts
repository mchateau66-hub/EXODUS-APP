import { prisma } from "@/lib/db";
import type { EntitlementClaim } from "@/lib/entitlements-guard";
import { logSecurity } from "@/lib/security-log";
import { HttpError } from "@/lib/http-error";

function unauthorized(msg = "unauthorized"): never {
  throw new HttpError(401, msg, msg);
}

/**
 * Anti-replay : consomme un `jti` une seule fois.
 * - attendu : contrainte d'unicité en DB sur `entitlementJti.jti`.
 * - en cas de collision -> `replayed_token` (401)
 */
export async function consumeJtiOnce(claim: EntitlementClaim) {
  try {
    await prisma.entitlementJti.create({
      data: {
        jti: claim.jti,
        user_id: claim.sub,
        sid: claim.sid ?? null,
        exp_at: new Date(claim.exp * 1000),
      },
    });
  } catch (e: unknown) {
    // Prisma P2002 = unique constraint failed
    if (e && typeof e === "object" && "code" in e && (e as { code?: unknown }).code === "P2002") {
      logSecurity("replayed_token", { userId: claim.sub, jti: claim.jti });
      unauthorized("replayed_token");
    }
    throw e;
  }
}

