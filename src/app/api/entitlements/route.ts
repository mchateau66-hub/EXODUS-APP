// src/app/api/entitlements/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Un entitlement est actif si :
 * - starts_at <= now
 * - et (expires_at est null OU expires_at > now)
 */
function isEntitlementActive(
  ent: { starts_at: Date; expires_at: Date | null },
  now: Date,
) {
  if (ent.starts_at > now) return false
  if (ent.expires_at && ent.expires_at <= now) return false
  return true
}

/**
 * GET /api/entitlements
 *
 * Retourne un "claim" compatible avec le type EntitlementClaim côté front :
 *
 * {
 *   ok: true,
 *   claim: {
 *     sub, plan, features, sid, device, iat, exp, jti, ver
 *   }
 * }
 */
export async function GET(_req: NextRequest) {
  const session = await getUserFromSession()

  if (!session) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 },
    )
  }

  const { user, sid } = session
  const userId = (user as any).id as string
  const now = new Date()

  // 1) Récupérer tous les entitlements de l'utilisateur
  const entitlements = await prisma.userEntitlement.findMany({
    where: {
      user_id: userId,
    },
  })

  // 2) Filtrer seulement les entitlements actifs
  const activeEntitlements = entitlements.filter((ent) =>
    isEntitlementActive(ent, now),
  )

  // Liste unique de feature_keys (FeatureKey[])
  const features = Array.from(
    new Set(activeEntitlements.map((e) => e.feature_key)),
  )

  // 3) Déterminer le plan courant :
  //    - on cherche une Subscription "active-like" (active/trialing/past_due)
  //    - sinon fallback sur le plan "free" si présent
  const activeSub = await prisma.subscription.findFirst({
    where: {
      user_id: userId,
      status: {
        in: ['active', 'trialing', 'past_due'],
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  })

  let planKey: string | null = activeSub?.plan_key ?? null

  let planFromDb = planKey
    ? await prisma.plan.findUnique({ where: { key: planKey } })
    : null

  // Fallback : plan "free"
  if (!planFromDb) {
    planFromDb = await prisma.plan.findUnique({
      where: { key: 'free' },
    })
  }

  // Shape minimale compatible avec le type Plan côté front
  const plan =
    planFromDb != null
      ? {
          key: planFromDb.key,
          name: planFromDb.name,
          active: planFromDb.active,
        }
      : {
          key: 'free',
          name: 'Free',
          active: true,
        }

  // 4) Construire un "claim" de type EntitlementClaim
  const iatSec = Math.floor(now.getTime() / 1000)
  const expSec = iatSec + 5 * 60 // claim "valable" 5 minutes côté front

  const claim = {
    sub: userId,
    plan,
    features,
    sid,
    device: 'web',
    iat: iatSec,
    exp: expSec,
    jti: `${sid}-${iatSec}`,
    ver: 1,
  }

  return NextResponse.json({
    ok: true,
    claim,
  })
}
