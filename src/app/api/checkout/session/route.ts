import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { limitSeconds, rateHeaders, rateKeyFromRequest } from '@/lib/ratelimit'

export const runtime = 'nodejs'

// --------- Types & constantes ---------

const ALLOWED_PLANS = ['athlete_premium', 'coach_premium'] as const
type PlanKey = (typeof ALLOWED_PLANS)[number]

type BillingPeriod = 'monthly' | 'yearly'

type CheckoutSessionResponse =
  | { ok: true; url: string | null; id: string | null; error?: undefined }
  | { ok: false; url?: undefined; id?: undefined; error: string }

type CheckoutSessionBody = {
  planKey?: string
  billingPeriod?: string
  successUrl?: string
  cancelUrl?: string
  analyticsSessionId?: string
}

type SessionUserRole = 'athlete' | 'coach' | 'admin'

interface CheckoutUser {
  id: string
  role: SessionUserRole
  email: string | null
  stripe_customer_id: string | null
}

// --------- Helpers type-safe ---------

function isPlanKey(value: unknown): value is PlanKey {
  return (
    typeof value === 'string' &&
    (ALLOWED_PLANS as readonly string[]).includes(value)
  )
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function isBillingPeriod(value: unknown): value is BillingPeriod {
  return value === 'monthly' || value === 'yearly'
}

function isCheckoutUser(value: unknown): value is CheckoutUser {
  if (!value || typeof value !== 'object') return false
  const maybe = value as {
    id?: unknown
    role?: unknown
    email?: unknown
    stripe_customer_id?: unknown
  }

  if (typeof maybe.id !== 'string') return false
  if (maybe.role !== 'athlete' && maybe.role !== 'coach' && maybe.role !== 'admin') {
    return false
  }

  const emailOk =
    maybe.email === null ||
    typeof maybe.email === 'string' ||
    typeof maybe.email === 'undefined'

  const stripeIdOk =
    maybe.stripe_customer_id === null ||
    typeof maybe.stripe_customer_id === 'string' ||
    typeof maybe.stripe_customer_id === 'undefined'

  return emailOk && stripeIdOk
}

function jsonWithHeaders(
  body: CheckoutSessionResponse,
  init: ResponseInit = {},
  extraHeaders?: Headers,
): NextResponse<CheckoutSessionResponse> {
  const headers = new Headers(init.headers)
  headers.set('cache-control', 'no-store')

  if (extraHeaders) {
    extraHeaders.forEach((value, key) => {
      headers.set(key, value)
    })
  }

  return NextResponse.json(body, {
    ...init,
    headers,
  })
}

async function getCheckoutUserFromSession(): Promise<CheckoutUser | null> {
  const rawSession: unknown = await getUserFromSession()
  if (!rawSession || typeof rawSession !== 'object') return null
  if (!('user' in rawSession)) return null

  const maybeUser = (rawSession as { user?: unknown }).user
  if (!isCheckoutUser(maybeUser)) return null

  return {
    id: maybeUser.id,
    role: maybeUser.role,
    email: maybeUser.email ?? null,
    stripe_customer_id: maybeUser.stripe_customer_id ?? null,
  }
}

async function parseJsonBody<T>(req: NextRequest): Promise<T | null> {
  try {
    const raw: unknown = await req.json()
    if (!raw || typeof raw !== 'object') return null
    return raw as T
  } catch {
    return null
  }
}

function getPriceIdFromEnv(planKey: PlanKey, billing: BillingPeriod): string | null {
  if (planKey === 'athlete_premium' && billing === 'monthly') {
    return process.env.STRIPE_PRICE_ATHLETE_PREMIUM_MONTHLY ?? null
  }
  if (planKey === 'coach_premium' && billing === 'monthly') {
    return process.env.STRIPE_PRICE_COACH_PREMIUM_MONTHLY ?? null
  }
  return null
}

// --------- Route handler ---------

export async function POST(
  req: NextRequest,
): Promise<NextResponse<CheckoutSessionResponse>> {
  const user = await getCheckoutUserFromSession()
  if (!user) {
    return jsonWithHeaders({ ok: false, error: 'invalid_session' }, { status: 401 })
  }

  const limitN = parseInt(process.env.RATELIMIT_CHECKOUT_SESSION_LIMIT || '5', 10)
  const windowS = parseInt(process.env.RATELIMIT_CHECKOUT_SESSION_WINDOW_S || '300', 10)

  const rlKey = rateKeyFromRequest(req, user.id)
  const rl = await limitSeconds(
    'checkout_session',
    rlKey,
    limitN > 0 ? limitN : 5,
    Math.max(1, windowS),
  )
  const rlHeaders = rateHeaders(rl)

  if (!rl.ok) {
    return jsonWithHeaders(
      { ok: false, error: 'rate_limited' },
      { status: 429 },
      rlHeaders,
    )
  }

  const body = (await parseJsonBody<CheckoutSessionBody>(req)) ?? {}

  const planKey: PlanKey = isPlanKey(body.planKey) ? body.planKey : 'athlete_premium'
  const billingPeriod: BillingPeriod = isBillingPeriod(body.billingPeriod) ? body.billingPeriod : 'monthly'

  if (!ALLOWED_PLANS.includes(planKey)) {
    return jsonWithHeaders(
      { ok: false, error: 'unsupported_plan' },
      { status: 400 },
      rlHeaders,
    )
  }

  if (planKey === 'athlete_premium' && user.role !== 'athlete') {
    return jsonWithHeaders(
      { ok: false, error: 'forbidden_for_role' },
      { status: 403 },
      rlHeaders,
    )
  }

  if (planKey === 'coach_premium' && user.role !== 'coach') {
    return jsonWithHeaders(
      { ok: false, error: 'forbidden_for_role' },
      { status: 403 },
      rlHeaders,
    )
  }

  const analyticsSessionId = isNonEmptyString(body.analyticsSessionId)
    ? body.analyticsSessionId
    : null

  // 1) Ensure Stripe customer
  let stripeCustomerId: string | null = user.stripe_customer_id

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: {
        user_id: user.id,
        role: user.role,
      },
    })

    stripeCustomerId = customer.id

    await prisma.user.update({
      where: { id: user.id },
      data: { stripe_customer_id: stripeCustomerId },
    })
  }

  if (!stripeCustomerId) {
    return jsonWithHeaders(
      { ok: false, error: 'stripe_customer_missing' },
      { status: 500 },
      rlHeaders,
    )
  }

  // 2) price_id via Plan DB (fallback env)
  const plan = await prisma.plan.findUnique({
    where: { key: planKey },
    select: {
      stripe_price_id_monthly: true,
      stripe_price_id_yearly: true,
      active: true,
    },
  })

  if (plan && plan.active === false) {
    return jsonWithHeaders(
      { ok: false, error: 'plan_inactive' },
      { status: 400 },
      rlHeaders,
    )
  }

  let priceId: string | null =
    plan
      ? (billingPeriod === 'monthly' ? plan.stripe_price_id_monthly : plan.stripe_price_id_yearly)
      : null

  if (!priceId) priceId = getPriceIdFromEnv(planKey, billingPeriod)

  if (!priceId) {
    return jsonWithHeaders(
      { ok: false, error: 'price_not_configured' },
      { status: 500 },
      rlHeaders,
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin

  const successUrl =
    body.successUrl ?? `${baseUrl}/paywall/success?plan=${encodeURIComponent(planKey)}`
  const cancelUrl =
    body.cancelUrl ?? `${baseUrl}/paywall?plan=${encodeURIComponent(planKey)}&canceled=1`

  // analytics: checkout_start
  if (analyticsSessionId) {
    await prisma.event.create({
      data: {
        session_id: analyticsSessionId,
        user_id: user.id,
        event: 'checkout_start',
        role: user.role,
        offer: planKey,
        billing: billingPeriod,
        meta: { price_id: priceId },
      },
    })
  }

  // 3) Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,

    metadata: {
      user_id: user.id,
      planKey,
      billingPeriod,
      analytics_session_id: analyticsSessionId ?? '',
    },

    subscription_data: {
      metadata: {
        user_id: user.id,
        planKey,
        billingPeriod,
        analytics_session_id: analyticsSessionId ?? '',
      },
    },
  })

  return jsonWithHeaders(
    { ok: true, url: session.url ?? null, id: session.id ?? null },
    { status: 200 },
    rlHeaders,
  )
}