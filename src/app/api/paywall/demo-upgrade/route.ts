import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'

async function getPrismaSafe() {
  try {
    const { PrismaClient } = await import('@prisma/client')
    return new PrismaClient()
  } catch (e) {
    console.error(
      'Impossible de charger @prisma/client (/api/paywall/demo-upgrade)',
      e,
    )
    return null
  }
}

const MASTER_PLAN_KEY = 'master'
const PRO_FEATURE_KEY = 'messages.unlimited'

export async function POST(_req: NextRequest) {
  const sessionCtx = await getUserFromSession()
  if (!sessionCtx?.user) {
    return NextResponse.json(
      { ok: false, error: 'invalid_session' },
      { status: 401 },
    )
  }

  const userId = sessionCtx.user.id
  const prisma = await getPrismaSafe()
  if (!prisma) {
    return NextResponse.json(
      { ok: false, error: 'server_error' },
      { status: 500 },
    )
  }

  try {
    const demoSubId = `demo-sub-${userId}`

    await prisma.$transaction(async (tx) => {
      // 1) Plan "master"
      const plan = await tx.plan.upsert({
        where: { key: MASTER_PLAN_KEY },
        create: {
          key: MASTER_PLAN_KEY,
          name: 'Plan Pro (démo)',
        },
        update: {},
      })

      // 2) Feature "messages.unlimited"
      const feature = await tx.feature.upsert({
        where: { key: PRO_FEATURE_KEY },
        create: {
          key: PRO_FEATURE_KEY,
          description: 'Messagerie illimitée avec le coach',
        },
        update: {},
      })

      // (optionnel) lien plan <-> feature dans la table PlanFeature
      await tx.planFeature
        .upsert({
          where: {
            plan_key_feature_key: {
              plan_key: plan.key,
              feature_key: feature.key,
            },
          },
          create: {
            plan_key: plan.key,
            feature_key: feature.key,
          },
          update: {},
        })
        .catch(() => {
          // si la table PlanFeature n'existe pas ou le composite a un autre nom,
          // on ignore — ce n'est pas bloquant pour la démo
        })

      // 3) Subscription liée à ce plan
      const subscription = await tx.subscription.upsert({
        where: {
          stripe_subscription_id: demoSubId,
        },
        create: {
          user_id: userId,
          plan_key: plan.key,
          stripe_subscription_id: demoSubId,
          status: 'active',
        },
        update: {
          plan_key: plan.key,
          status: 'active',
          canceled_at: null,
          expires_at: null,
        },
      })

      // 4) Entitlement messages.unlimited pour cet utilisateur
      await tx.userEntitlement
        .create({
          data: {
            user_id: userId,
            feature_key: feature.key,
            source: 'promo',
            subscription_id: subscription.id,
          },
        })
        .catch((err) => {
          // P2002 = déjà présent → on ignore
          if ((err as any)?.code !== 'P2002') {
            throw err
          }
        })
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    console.error('Erreur /api/paywall/demo-upgrade', e)
    return NextResponse.json(
      { ok: false, error: 'server_error' },
      { status: 500 },
    )
  }
}
