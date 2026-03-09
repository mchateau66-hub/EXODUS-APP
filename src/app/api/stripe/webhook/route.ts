// src/app/api/stripe/webhook/route.ts
import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import { BillingPeriod } from '@prisma/client'

export const runtime = 'nodejs'

function ok() {
  return new Response('ok', {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function bad(msg: string, status = 400) {
  return new Response(msg, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/**
 * 🔒 Offers autorisées côté serveur.
 * Même si on résout via DB, on refuse toute valeur surprise.
 */
const ALLOWED_OFFERS = new Set(['free', 'athlete_premium', 'coach_premium'])

function assertOfferAllowed(offer: string) {
  if (!ALLOWED_OFFERS.has(offer)) {
    throw new Error(`Offer not allowed: ${offer}`)
  }
}

/**
 * 🔒 Flag runtime (canary/rollback via env)
 * - CANARY_ENABLED=1 + CANARY_PERCENT=5 => active “strict” sur 5% (déterministe par userId)
 * - FLAG_STRICT_PRICE_MAPPING=0 => désactive totalement (rollback instant)
 */
function envOn(name: string, defaultValue = '0') {
  const v = (process.env[name] ?? defaultValue).toString()
  return v === '1' || v.toLowerCase() === 'true'
}

function inCanary(userId: string | null | undefined, percent: number): boolean {
  if (!userId) return false
  const p = Math.max(0, Math.min(100, percent))
  // hash déterministe sans crypto import (simple & suffisant pour buckets)
  let h = 0
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0
  }
  const bucket = h % 100
  return bucket < p
}

function isStrictPriceMappingEnabled(userId?: string | null) {
  if (!envOn('FLAG_STRICT_PRICE_MAPPING', '1')) return false
  if (!envOn('CANARY_ENABLED', '0')) return true
  const pct = Number(process.env.CANARY_PERCENT ?? '5')
  return inCanary(userId ?? null, Number.isFinite(pct) ? pct : 5)
}

type SubStatus = 'incomplete' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'

function mapStripeStatus(status: Stripe.Subscription.Status): SubStatus {
  switch (status) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'canceled':
    case 'unpaid':
      return status
    default:
      return 'incomplete'
  }
}

function fromUnixSeconds(v: number | null | undefined): Date | null {
  if (!v) return null
  return new Date(v * 1000)
}

function nonEmptyString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

function toBillingPeriod(v: unknown): BillingPeriod | null {
  if (v === 'monthly') return BillingPeriod.monthly
  if (v === 'yearly') return BillingPeriod.yearly
  return null
}

function billingFromStripe(sub: Stripe.Subscription): BillingPeriod | null {
  const interval = sub.items.data[0]?.price?.recurring?.interval
  if (interval === 'month') return BillingPeriod.monthly
  if (interval === 'year') return BillingPeriod.yearly
  return null
}

async function audit(action: string, userId: string | null, meta: Record<string, any>) {
  await prisma.auditLog.create({
    data: {
      user_id: userId,
      action,
      meta,
    },
  })
}

/**
 * ✅ STRICT resolver (avec canary / rollback):
 * - Source de vérité = DB (Plan.active + priceId match)
 * - metadata.planKey ignoré pour les droits (signal log only)
 * - si priceId inconnu :
 *    - strict ON  => throw (Stripe retry) => empêche toute sub “non mappée”
 *    - strict OFF => warn + retourne planKey null (on n'écrit rien)
 */
async function resolvePlanKeyAndBilling(
  sub: Stripe.Subscription,
  userIdForCanary?: string | null,
) {
  const stripeSubId = sub.id
  const priceId = sub.items.data[0]?.price?.id ?? null

  if (!priceId) {
    // pas de price => pas de plan => on refuse (toujours)
    throw new Error(`Stripe subscription has no priceId (sub=${stripeSubId})`)
  }

  // Billing: Stripe interval d’abord
  let billing: BillingPeriod | null =
    toBillingPeriod((sub.metadata as any)?.billingPeriod ?? null) ?? billingFromStripe(sub)

  const plan = await prisma.plan.findFirst({
    where: {
      active: true,
      OR: [{ stripe_price_id_monthly: priceId }, { stripe_price_id_yearly: priceId }],
    },
    select: {
      key: true,
      stripe_price_id_monthly: true,
      stripe_price_id_yearly: true,
    },
  })

  const strict = isStrictPriceMappingEnabled(userIdForCanary ?? null)

  if (!plan) {
    if (strict) {
      throw new Error(`Unknown Stripe priceId=${priceId} for sub=${stripeSubId}`)
    }
    console.warn('Webhook: Unknown Stripe priceId (soft)', { priceId, stripeSubId })
    return { planKey: null as string | null, priceId, billing }
  }

  // Ajuste billing si besoin via match DB
  if (!billing) {
    if (plan.stripe_price_id_yearly === priceId) billing = BillingPeriod.yearly
    else if (plan.stripe_price_id_monthly === priceId) billing = BillingPeriod.monthly
  }

  assertOfferAllowed(plan.key)

  // Signal uniquement (log) : metadata.planKey (non fiable)
  const metaPlanKey = nonEmptyString((sub.metadata as any)?.planKey)
  if (metaPlanKey && metaPlanKey !== plan.key) {
    console.warn('Webhook: metadata planKey mismatch (ignored)', {
      stripeSubId,
      priceId,
      metaPlanKey,
      resolvedPlanKey: plan.key,
    })
  }

  return { planKey: plan.key, priceId, billing }
}

type SyncSummary = {
  userId: string
  role: 'coach' | 'athlete' | 'admin' | null
  customerId: string
  stripeSubId: string
  planKey: string
  prevStatus: SubStatus | null
  nextStatus: SubStatus
  prevCancelAtPeriodEnd: boolean | null
  nextCancelAtPeriodEnd: boolean
  analyticsSessionId: string | null
  currentPeriodEndUnix: number | null
  cancelAtUnix: number | null
}

async function upsertSubscriptionAndEntitlements(
  sub: Stripe.Subscription,
  userIdHint?: string,
): Promise<SyncSummary | null> {
  const customerId = sub.customer as string
  const stripeSubId = sub.id
  const nextStatus = mapStripeStatus(sub.status)

  const currentPeriodStart = fromUnixSeconds((sub as any).current_period_start)
  const currentPeriodEnd = fromUnixSeconds((sub as any).current_period_end)
  const trialEndAt = fromUnixSeconds((sub as any).trial_end)
  const canceledAt = fromUnixSeconds((sub as any).canceled_at)

  const nextCancelAtPeriodEnd = !!sub.cancel_at_period_end

  const isEntitled = nextStatus === 'active' || nextStatus === 'trialing'
  const expiresAt = isEntitled ? null : (currentPeriodEnd ?? new Date())

  const analyticsSessionId = nonEmptyString((sub.metadata as any)?.analytics_session_id)

  // Trouve l'user (on essaie userIdHint d’abord, sinon via stripe_customer_id)
  const user =
    (userIdHint
      ? await prisma.user.findUnique({
          where: { id: userIdHint },
          select: { id: true, role: true, stripe_customer_id: true },
        })
      : null) ??
    (await prisma.user.findUnique({
      where: { stripe_customer_id: customerId },
      select: { id: true, role: true, stripe_customer_id: true },
    }))

  if (!user) {
    console.warn('Webhook: user not found', { userIdHint, customerId, stripeSubId })
    return null
  }

  // ✅ strict/canary se base sur user.id (stable)
  const { planKey, priceId, billing } = await resolvePlanKeyAndBilling(sub, user.id)

  // mode soft => on ne touche rien
  if (!planKey) {
    console.warn('Webhook: planKey not resolved (soft mode)', { stripeSubId, priceId })
    return null
  }

  const result = await prisma.$transaction(async (tx) => {
    const prev = await tx.subscription.findUnique({
      where: { stripe_subscription_id: stripeSubId },
      select: { status: true, cancel_at_period_end: true, id: true },
    })

    const subscription = await tx.subscription.upsert({
      where: { stripe_subscription_id: stripeSubId },
      update: {
        user_id: user.id,
        plan_key: planKey,
        stripe_customer_id: customerId,
        status: nextStatus as any,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: nextCancelAtPeriodEnd,
        canceled_at: canceledAt,
        trial_end_at: trialEndAt,
        expires_at: expiresAt,
        updated_at: new Date(),
        billing,
      },
      create: {
        user_id: user.id,
        plan_key: planKey,
        stripe_customer_id: customerId,
        stripe_subscription_id: stripeSubId,
        status: nextStatus as any,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: nextCancelAtPeriodEnd,
        canceled_at: canceledAt,
        trial_end_at: trialEndAt,
        expires_at: expiresAt,
        billing,
      },
      select: { id: true, status: true, cancel_at_period_end: true },
    })

    // Reset entitlements "plan" pour cette subscription
    await tx.userEntitlement.deleteMany({
      where: {
        user_id: user.id,
        source: 'plan',
        subscription_id: subscription.id,
      },
    })

    const planFeatures = await tx.planFeature.findMany({
      where: { plan_key: planKey },
      select: { feature_key: true },
    })

    if (planFeatures.length > 0) {
      const now = new Date()
      await tx.userEntitlement.createMany({
        data: planFeatures.map((pf) => ({
          user_id: user.id,
          feature_key: pf.feature_key,
          source: 'plan',
          subscription_id: subscription.id,
          starts_at: now,
          expires_at: expiresAt,
          meta: { plan_key: planKey },
        })),
        skipDuplicates: true,
      })
    } else {
      console.warn('Webhook: no PlanFeature for planKey', { planKey, stripeSubId })
    }

    return {
      prevStatus: (prev?.status as SubStatus | null) ?? null,
      prevCancelAtPeriodEnd: prev?.cancel_at_period_end ?? null,
      nextStatus: subscription.status as unknown as SubStatus,
      nextCancelAtPeriodEnd: subscription.cancel_at_period_end,
    }
  })

  const currentPeriodEndUnix =
    typeof (sub as any).current_period_end === 'number' ? (sub as any).current_period_end : null
  const cancelAtUnix = typeof (sub as any).cancel_at === 'number' ? (sub as any).cancel_at : null

  console.log(
    '[Stripe] synced user=%s plan=%s sub=%s status=%s cancel_at_period_end=%s billing=%s',
    user.id,
    planKey,
    stripeSubId,
    nextStatus,
    nextCancelAtPeriodEnd,
    billing ?? 'null',
  )

  return {
    userId: user.id,
    role: (user.role as any) ?? null,
    customerId,
    stripeSubId,
    planKey,
    prevStatus: result.prevStatus,
    nextStatus: result.nextStatus,
    prevCancelAtPeriodEnd: result.prevCancelAtPeriodEnd,
    nextCancelAtPeriodEnd: result.nextCancelAtPeriodEnd,
    analyticsSessionId,
    currentPeriodEndUnix,
    cancelAtUnix,
  }
}

export async function POST(req: NextRequest) {
  const headersList = await headers()
  const sig = headersList.get('stripe-signature')
  if (!sig) return bad('Missing stripe-signature', 400)

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) return bad('Webhook config error', 500)

  // ✅ Anti abuse — limite 1MB
  const len = Number(req.headers.get('content-length') || '0')
  if (len && len > 1_000_000) {
    return bad('Payload too large', 413)
  }

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err: any) {
    console.error('Stripe webhook signature error:', err?.message)
    return bad('Invalid signature', 400)
  }

  // ✅ Livemode guard (évite test events en prod)
  const expectedLivemode = process.env.STRIPE_LIVEMODE === '1'
  if (event.livemode !== expectedLivemode) {
    console.warn('Stripe livemode mismatch', {
      eventLivemode: event.livemode,
      expectedLivemode,
      id: event.id,
      type: event.type,
    })
    return ok()
  }

  // ✅ Idempotence (ignore retries Stripe)
  try {
    await prisma.stripeEvent.create({
      data: {
        id: event.id,
        type: event.type,
        created: event.created,
        livemode: event.livemode,
      },
    })
  } catch {
    return ok()
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        const userIdHint = nonEmptyString(session.metadata?.user_id) ?? undefined
        const analyticsSessionId = nonEmptyString(session.metadata?.analytics_session_id)

        // ⚠️ On ne fait PAS confiance à planKey/billingPeriod pour les droits,
        // mais on peut les auditer (analytics).
        const requestedPlanKey = nonEmptyString(session.metadata?.planKey) ?? null
        const requestedBilling = nonEmptyString(session.metadata?.billingPeriod) ?? null

        if (analyticsSessionId) {
          await audit('checkout_success', userIdHint ?? null, {
            session_id: analyticsSessionId,
            offer: requestedPlanKey,
            billing: requestedBilling,
            stripe_session_id: session.id,
            stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
            stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
          })
        }

        if (typeof session.subscription === 'string') {
          const sub = await stripe.subscriptions.retrieve(session.subscription, {
            expand: ['items.data.price'],
          })
          await upsertSubscriptionAndEntitlements(sub as Stripe.Subscription, userIdHint)
        }

        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subLite = event.data.object as Stripe.Subscription
        const sub = await stripe.subscriptions.retrieve(subLite.id, {
          expand: ['items.data.price'],
        })
        await upsertSubscriptionAndEntitlements(sub as Stripe.Subscription)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice

        const stripeSubId =
          typeof (invoice as any).subscription === 'string' ? ((invoice as any).subscription as string) : null

        if (stripeSubId) {
          await prisma.subscription.updateMany({
            where: { stripe_subscription_id: stripeSubId },
            data: {
              status: 'past_due' as any,
              updated_at: new Date(),
            },
          })
        }

        break
      }

      default:
        console.log('Unhandled Stripe event type:', event.type)
    }

    return ok()
  } catch (err) {
    // 🔒 Important : si price_id inconnu en strict => throw => 500 => Stripe retente.
    // Ça évite d’enregistrer une sub invalide et te force à seed/mapper le plan.
    console.error('Stripe webhook handler error:', err)
    return bad('Webhook handler error', 500)
  }
}