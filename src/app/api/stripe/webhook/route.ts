// src/app/api/stripe/webhook/route.ts
import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

// helper: map statut Stripe → SubStatus Prisma
function mapStripeStatus(
  status: Stripe.Subscription.Status,
):
  | 'incomplete'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid' {
  switch (status) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'past_due':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    case 'unpaid':
      return 'unpaid'
    default:
      return 'incomplete'
  }
}

function fromUnixSeconds(
  value: number | null | undefined,
): Date | null {
  if (!value) return null
  return new Date(value * 1000)
}

/**
 * Sync d'une subscription Stripe → Subscription + UserEntitlement en DB
 */
async function upsertSubscriptionAndEntitlements(
  sub: Stripe.Subscription,
) {
  const customerId = sub.customer as string
  const stripeSubId = sub.id
  const status = mapStripeStatus(sub.status)

  // Certains champs ne sont pas exposés typés dans le SDK → cast any
  const currentPeriodStart = fromUnixSeconds(
    (sub as any).current_period_start,
  )
  const currentPeriodEnd = fromUnixSeconds(
    (sub as any).current_period_end,
  )

  const expiresAt =
    status === 'active' || status === 'trialing'
      ? null
      : currentPeriodEnd

  // 1) Récupérer le user via stripe_customer_id
  const user = await prisma.user.findUnique({
    where: { stripe_customer_id: customerId },
  })

  if (!user) {
    console.warn('Webhook: user not found for customer', {
      customerId,
    })
    return
  }

  // 2) Déterminer plan_key (metadata.planKey ou lookup via price_id)
  const lineItem = sub.items.data[0]
  const priceId = lineItem?.price?.id ?? null

  let planKey: string | null =
    (sub.metadata as any)?.planKey ?? null

  if (!planKey && priceId) {
    const plan = await prisma.plan.findFirst({
      where: {
        OR: [
          { stripe_price_id_monthly: priceId },
          { stripe_price_id_yearly: priceId },
        ],
      },
    })
    planKey = plan?.key ?? null
  }

  if (!planKey) {
    console.warn('Webhook: planKey not resolved', {
      stripeSubId,
      priceId,
    })
    return
  }

  // 3) Upsert Subscription
  const subscription = await prisma.subscription.upsert({
    where: { stripe_subscription_id: stripeSubId },
    update: {
      status,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      canceled_at: (sub as any).canceled_at
        ? fromUnixSeconds((sub as any).canceled_at)
        : null,
      plan_key: planKey,
      updated_at: new Date(),
    },
    create: {
      user_id: user.id,
      plan_key: planKey,
      stripe_customer_id: customerId,
      stripe_subscription_id: stripeSubId,
      status,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      canceled_at: (sub as any).canceled_at
        ? fromUnixSeconds((sub as any).canceled_at)
        : null,
    },
  })

  // 4) Nettoyer les anciens entitlements de ce plan / subscription
  await prisma.userEntitlement.deleteMany({
    where: {
      user_id: user.id,
      source: 'plan',
      subscription_id: subscription.id,
    },
  })

  // 5) Récupérer les features du plan
  const planFeatures = await prisma.planFeature.findMany({
    where: { plan_key: planKey },
    include: { feature: true },
  })

  if (planFeatures.length === 0) {
    console.warn('Webhook: no PlanFeature for planKey', {
      planKey,
      stripeSubId,
    })
    return
  }

  const now = new Date()
  const entitlementsExpiresAt = expiresAt

  // 6) Créer les entitlements à partir des PlanFeature
  await prisma.userEntitlement.createMany({
    data: planFeatures.map((pf) => ({
      user_id: user.id,
      feature_key: pf.feature_key,
      source: 'plan',
      subscription_id: subscription.id,
      starts_at: now,
      expires_at: entitlementsExpiresAt,
      meta: {},
    })),
  })

  console.log(
    '[Stripe] Entitlements synced for user=%s plan=%s sub=%s features=%s',
    user.id,
    planKey,
    stripeSubId,
    planFeatures.map((pf) => pf.feature_key).join(','),
  )
}

export async function POST(req: NextRequest) {
  // Next 15 : headers() est async
  const headersList = await headers()
  const sig = headersList.get('stripe-signature') ?? ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set')
    return new Response('Webhook config error', { status: 500 })
  }

  const rawBody = await req.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      webhookSecret,
    )
  } catch (err: any) {
    console.error('Stripe webhook signature error', err)
    return new Response(`Webhook Error: ${err.message}`, {
      status: 400,
    })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string,
          )
          await upsertSubscriptionAndEntitlements(
            sub as Stripe.Subscription,
          )
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await upsertSubscriptionAndEntitlements(sub)
        break
      }

      default: {
        console.log('Unhandled Stripe event type', event.type)
      }
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('Error handling Stripe webhook', err)
    return new Response('Webhook handler error', { status: 500 })
  }
}
