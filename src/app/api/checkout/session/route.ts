// src/app/api/checkout/session/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

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
  if (
    maybe.role !== 'athlete' &&
    maybe.role !== 'coach' &&
    maybe.role !== 'admin'
  ) {
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

async function getCheckoutUserFromSession(): Promise<CheckoutUser | null> {
  const rawSession: unknown = await getUserFromSession()

  if (!rawSession || typeof rawSession !== 'object') {
    return null
  }

  if (!('user' in rawSession)) {
    return null
  }

  const maybeUser = (rawSession as { user?: unknown }).user

  if (!isCheckoutUser(maybeUser)) {
    return null
  }

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
    if (!raw || typeof raw !== 'object') {
      return null
    }
    return raw as T
  } catch {
    return null
  }
}

function getPriceIdFromEnv(
  planKey: PlanKey,
  billing: BillingPeriod,
): string | null {
  if (planKey === 'athlete_premium' && billing === 'monthly') {
    return process.env.STRIPE_PRICE_ATHLETE_PREMIUM_MONTHLY ?? null
  }
  if (planKey === 'coach_premium' && billing === 'monthly') {
    return process.env.STRIPE_PRICE_COACH_PREMIUM_MONTHLY ?? null
  }
  // à compléter plus tard si tu rajoutes d’autres prix
  return null
}

// --------- Route handler ---------

export async function POST(
  req: NextRequest,
): Promise<NextResponse<CheckoutSessionResponse>> {
  const user = await getCheckoutUserFromSession()

  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'invalid_session' },
      { status: 401 },
    )
  }

  const body =
    (await parseJsonBody<CheckoutSessionBody>(req)) ?? {}

  const requestedPlanKey = body.planKey
  const requestedBilling = body.billingPeriod

  const planKey: PlanKey = isPlanKey(requestedPlanKey)
    ? requestedPlanKey
    : 'athlete_premium'

  const billingPeriod: BillingPeriod = isBillingPeriod(
    requestedBilling,
  )
    ? requestedBilling
    : 'monthly'

  if (!ALLOWED_PLANS.includes(planKey)) {
    return NextResponse.json(
      { ok: false, error: 'unsupported_plan' },
      { status: 400 },
    )
  }

  // Règles de rôle : athlète vs coach
  if (planKey === 'athlete_premium' && user.role !== 'athlete') {
    return NextResponse.json(
      { ok: false, error: 'forbidden_for_role' },
      { status: 403 },
    )
  }

  if (planKey === 'coach_premium' && user.role !== 'coach') {
    return NextResponse.json(
      { ok: false, error: 'forbidden_for_role' },
      { status: 403 },
    )
  }

  // 1) Stripe customer
  let stripeCustomerId: string | null = user.stripe_customer_id

  if (!stripeCustomerId) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: {
        userId: user.id,
        role: user.role,
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    stripeCustomerId = customer.id as string

    await prisma.user.update({
      where: { id: user.id },
      data: { stripe_customer_id: stripeCustomerId },
    })
  }

  // Par sécurité : si malgré tout on n'a toujours pas d'id client Stripe
  if (!stripeCustomerId) {
    console.error(
      `Stripe customer id still missing after creation for user=${user.id}`,
    )
    return NextResponse.json(
      { ok: false, error: 'stripe_customer_missing' },
      { status: 500 },
    )
  }

  const customerIdForStripe: string = stripeCustomerId

  // 2) Récup du price_id (Plan -> env)
  const plan = await prisma.plan.findUnique({
    where: { key: planKey },
  })

  let priceId: string | null = null

  if (plan) {
    priceId =
      billingPeriod === 'monthly'
        ? plan.stripe_price_id_monthly
        : plan.stripe_price_id_yearly
  }

  if (!priceId) {
    priceId = getPriceIdFromEnv(planKey, billingPeriod)
  }

  if (!priceId) {
    console.error(
      `Stripe price id missing for planKey=${planKey}, billingPeriod=${billingPeriod}`,
    )
    return NextResponse.json(
      { ok: false, error: 'price_not_configured' },
      { status: 500 },
    )
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin

  const successUrl =
    body.successUrl ??
    `${baseUrl}/paywall/success?plan=${encodeURIComponent(
      planKey,
    )}`
  const cancelUrl =
    body.cancelUrl ??
    `${baseUrl}/paywall?plan=${encodeURIComponent(
      planKey,
    )}&canceled=1`

  // 3) Création session Checkout
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerIdForStripe,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    metadata: {
      userId: user.id,
      planKey,
      billingPeriod,
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        planKey,
      },
    },
  })

  const response: CheckoutSessionResponse = {
    ok: true,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    url: session.url ?? null,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    id: session.id ?? null,
  }

  return NextResponse.json(response, { status: 200 })
}
