// src/app/api/stripe/webhook/route.ts
import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import { BillingPeriod } from '@prisma/client'

function ok() {
  return new Response("ok", {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function bad(msg: string, status = 400) {
  return new Response(msg, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export const runtime = 'nodejs'

type SubStatus =
  | 'incomplete'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'

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

function isActiveLike(s: SubStatus | null | undefined) {
  return s === 'active' || s === 'trialing'
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

async function resolvePlanKeyAndBilling(sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price?.id ?? null

  let planKey: string | null = (sub.metadata as any)?.planKey ?? null
  let billing: BillingPeriod | null =
    toBillingPeriod((sub.metadata as any)?.billingPeriod ?? null) ??
    billingFromStripe(sub)

  if (!planKey && priceId) {
    const plan = await prisma.plan.findFirst({
      where: {
        OR: [
          { stripe_price_id_monthly: priceId },
          { stripe_price_id_yearly: priceId },
        ],
      },
      select: {
        key: true,
        stripe_price_id_monthly: true,
        stripe_price_id_yearly: true,
      },
    })

    planKey = plan?.key ?? null

    if (!billing && plan && priceId) {
      if (plan.stripe_price_id_yearly === priceId) billing = BillingPeriod.yearly
      else if (plan.stripe_price_id_monthly === priceId) billing = BillingPeriod.monthly
    }
  }

  return { planKey, priceId, billing }
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

  const { planKey, priceId, billing } = await resolvePlanKeyAndBilling(sub)
  if (!planKey) {
    console.warn('Webhook: planKey not resolved', { stripeSubId, priceId })
    return null
  }

  const analyticsSessionId = nonEmptyString((sub.metadata as any)?.analytics_session_id)

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
        billing, // ✅ BillingPeriod | null (plus de as any)
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
  const cancelAtUnix =
    typeof (sub as any).cancel_at === 'number' ? (sub as any).cancel_at : null

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
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");
  if (!sig) return bad("Missing stripe-signature", 400);

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return bad("Webhook config error", 500);

  // ✅ Anti abuse — limite 1MB
  const len = Number(req.headers.get("content-length") || "0");
  if (len && len > 1_000_000) {
    return bad("Payload too large", 413);
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("Stripe webhook signature error:", err?.message);
    return bad("Invalid signature", 400);
  }

  // ✅ Livemode guard (évite test events en prod)
  const expectedLivemode = process.env.STRIPE_LIVEMODE === "1";
  if (event.livemode !== expectedLivemode) {
    console.warn("Stripe livemode mismatch", {
      eventLivemode: event.livemode,
      expectedLivemode,
      id: event.id,
      type: event.type,
    });
    return ok();
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
    });
  } catch {
    return ok();
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userIdHint = nonEmptyString(session.metadata?.user_id) ?? undefined;
        const analyticsSessionId = nonEmptyString(session.metadata?.analytics_session_id);
        const planKey = nonEmptyString(session.metadata?.planKey) ?? null;
        const billingPeriod = nonEmptyString(session.metadata?.billingPeriod) ?? null;

        if (analyticsSessionId) {
          await audit("checkout_success", userIdHint ?? null, {
            session_id: analyticsSessionId,
            offer: planKey,
            billing: billingPeriod,
            stripe_session_id: session.id,
            stripe_customer_id:
              typeof session.customer === "string" ? session.customer : null,
            stripe_subscription_id:
              typeof session.subscription === "string"
                ? session.subscription
                : null,
          });
        }

        if (typeof session.subscription === "string") {
          const sub = await stripe.subscriptions.retrieve(session.subscription, {
            expand: ["items.data.price"],
          });
          await upsertSubscriptionAndEntitlements(
            sub as Stripe.Subscription,
            userIdHint,
          );
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subLite = event.data.object as Stripe.Subscription;
        const sub = await stripe.subscriptions.retrieve(subLite.id, {
          expand: ["items.data.price"],
        });

        await upsertSubscriptionAndEntitlements(sub as Stripe.Subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        const stripeSubId =
          typeof (invoice as any).subscription === "string"
            ? (invoice as any).subscription
            : null;

        if (stripeSubId) {
          await prisma.subscription.updateMany({
            where: { stripe_subscription_id: stripeSubId },
            data: {
              status: "past_due" as any,
              updated_at: new Date(),
            },
          });
        }

        break;
      }

      default:
        console.log("Unhandled Stripe event type:", event.type);
    }

    return ok();
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return bad("Webhook handler error", 500);
  }
}