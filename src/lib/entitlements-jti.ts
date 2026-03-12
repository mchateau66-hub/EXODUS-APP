import { prisma } from "@/lib/db"
import type { EntitlementClaim } from "@/lib/entitlements-guard"
import { logSecurity } from "@/lib/security-log"

function unauthorized(msg = "unauthorized"): never {
  const err = new Error(msg)
  ;(err as any).status = 401
  throw err
}

export async function consumeJtiOnce(claim: EntitlementClaim) {
  try {
    await prisma.entitlementJti.create({
      data: {
        jti: claim.jti,
        user_id: claim.sub,
        sid: claim.sid ?? null,
        exp_at: new Date(claim.exp * 1000),
      },
    })
  } catch (e: any) {
    // P2002 = duplicate key → replay
    if (e?.code === "P2002") {
      logSecurity("replayed_token", {
        userId: claim.sub,
        jti: claim.jti,
      })

      unauthorized("replayed_token")
    }

    throw e
  }
}