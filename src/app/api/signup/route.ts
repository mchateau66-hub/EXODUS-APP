// src/app/api/signup/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { createSessionResponseForUser } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { err } from '@/lib/api-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SignupRole = 'athlete' | 'coach'
type SignupPlan = 'free' | 'premium'

const PREMIUM_PLAN_KEYS = {
  athlete: 'athlete_premium',
  coach: 'coach_premium',
} as const

type PlanKey = (typeof PREMIUM_PLAN_KEYS)[keyof typeof PREMIUM_PLAN_KEYS]
type BillingPeriod = 'monthly' | 'yearly'

type SignupBody = {
  role?: string
  plan?: string
  email?: string
  name?: string
  password?: string
}

// --------- Helpers ---------

function isSignupRole(value: unknown): value is SignupRole {
  return value === 'athlete' || value === 'coach'
}

function isSignupPlan(value: unknown): value is SignupPlan {
  return value === 'free' || value === 'premium'
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

// --------- Handler ---------

export async function POST(req: NextRequest) {
  const body = await parseJsonBody<SignupBody>(req)
  if (!body) return err('invalid_body', 400)

  const roleRaw = body.role
  const planRaw = body.plan
  const emailRaw = body.email
  const nameRaw = body.name
  const passwordRaw = body.password

  if (!isSignupRole(roleRaw)) return err('unsupported_role', 400)
  if (!isSignupPlan(planRaw)) return err('unsupported_plan', 400)

  const role: SignupRole = roleRaw
  const plan: SignupPlan = planRaw

  const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : ''
  if (!email) return err('email_required', 400)

  const password = typeof passwordRaw === 'string' ? passwordRaw : ''
  if (!password) return err('password_required', 400)
  if (password.length < 8) return err('weak_password', 422)

  const name = typeof nameRaw === 'string' ? nameRaw.trim() : null

  try {
    // 1) Unicité email
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })
    if (existingUser) return err('email_already_used', 409)

    // 2) Create user
    const user = await prisma.user.create({
      data: {
        email,
        role,
        ...(name ? { name } : {}),
        passwordHash: hashPassword(password),
        onboardingStep: 0,
      },
      select: { id: true, email: true, role: true },
    })

    // 3) FREE
    if (plan === 'free') {
      return await createSessionResponseForUser(user.id, { ok: true, redirectTo: '/hub' })
    }

    // 4) PREMIUM (Stripe Checkout)
    const planKey: PlanKey = role === 'athlete' ? PREMIUM_PLAN_KEYS.athlete : PREMIUM_PLAN_KEYS.coach
    const billingPeriod: BillingPeriod = 'monthly'

    const planRow = await prisma.plan.findUnique({ where: { key: planKey } })

    let priceId: string | null =
      planRow
        ? billingPeriod === 'monthly'
          ? planRow.stripe_price_id_monthly
          : planRow.stripe_price_id_yearly
        : null

    if (!priceId) priceId = getPriceIdFromEnv(planKey, billingPeriod)

    if (!priceId) {
      console.error(`Stripe price id missing for planKey=${planKey}, billingPeriod=${billingPeriod}`)
      return err('price_not_configured', 500)
    }

    // 4.a Customer
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { userId: user.id, role: user.role },
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { stripe_customer_id: customer.id },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
    const successUrl = `${baseUrl}/hub`
    const cancelUrl = `${baseUrl}/signup?canceled=1&role=${encodeURIComponent(role)}&plan=${encodeURIComponent(plan)}`

    // 4.b Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: {
        userId: user.id,
        planKey,
        billingPeriod,
        signupRole: role,
      },
      subscription_data: {
        metadata: { userId: user.id, planKey },
      },
    })

    const checkoutUrl = session.url
    if (!checkoutUrl) {
      console.error('Stripe session created without url', { userId: user.id, planKey })
      return err('stripe_error', 500)
    }

    // ✅ session + cookie sid (auto-login premium)
    return await createSessionResponseForUser(user.id, { ok: true, checkoutUrl })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error'

    if (
      typeof message === 'string' &&
      (message.includes('Unique constraint') || message.includes('unique') || message.includes('P2002'))
    ) {
      return err('email_already_used', 409)
    }

    console.error('Error in POST /api/signup:', message)
    return err('server_error', 500)
  }
}
