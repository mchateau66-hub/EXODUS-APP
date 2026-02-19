import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

// TODO: remplace par ton guard admin existant
async function requireAdmin(_req: NextRequest) {
  // ex: check session role === 'admin'
  return true
}

type PlanPrice = {
  monthly: number
  yearly: number
}

const PLAN_PRICES_EUR: Record<string, PlanPrice> = {
  athlete_premium: { monthly: 19, yearly: 190 }, // <-- adapte
  coach_premium: { monthly: 29, yearly: 290 },   // <-- adapte
}

export async function GET(req: NextRequest) {
  await requireAdmin(req)

  const activeSubs = await prisma.subscription.findMany({
    where: { status: { in: ['active', 'trialing'] } },
    select: { id: true, user_id: true, plan_key: true },
  })

  const activeSubscriptions = activeSubs.length
  const activeUsers = new Set(activeSubs.map((s) => s.user_id)).size

  // split monthly/yearly : on déduit via plan pricing id (plus fiable si tu stockes billing ailleurs)
  // Ici on estime à partir de la présence plan_key uniquement => on fait simple.
  // Si tu veux EXACT: stocker billing sur Subscription (recommandé), on le fait après.
  let mrr = 0
  let monthlyCount = 0
  let yearlyCount = 0

  for (const s of activeSubs) {
    const pk = s.plan_key ?? ''
    const prices = PLAN_PRICES_EUR[pk]
    if (!prices) continue

    // fallback: considère monthly par défaut
    // -> meilleure version: ajouter Subscription.billing ('monthly'|'yearly')
    mrr += prices.monthly
    monthlyCount += 1
  }

  const arr = mrr * 12
  const arpu = activeUsers > 0 ? mrr / activeUsers : 0

  // churn rate (mensuel) simple: canceled ce mois / active fin mois précédent
  const now = new Date()
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const canceledThisMonth = await prisma.subscription.count({
    where: {
      status: { in: ['canceled', 'unpaid'] },
      canceled_at: { gte: startThisMonth },
    },
  })

  const activeLastMonth = await prisma.subscription.count({
    where: {
      status: { in: ['active', 'trialing'] },
      created_at: { lt: startThisMonth },
    },
  })

  const churnRate =
    activeLastMonth > 0 ? canceledThisMonth / activeLastMonth : 0

  // conversion rates: on base sur Events table
  // signup_to_paid: signup_submit -> checkout_success (par session_id)
  // hero_to_paid: hero_click -> checkout_success (par session_id)
  const [signupSessions, heroSessions, paidSessions] =
    await Promise.all([
      prisma.event.findMany({
        where: { event: 'signup_submit' },
        select: { session_id: true },
        distinct: ['session_id'],
      }),
      prisma.event.findMany({
        where: { event: 'hero_click' },
        select: { session_id: true },
        distinct: ['session_id'],
      }),
      prisma.event.findMany({
        where: { event: 'checkout_success' },
        select: { session_id: true },
        distinct: ['session_id'],
      }),
    ])

  const paidSet = new Set(paidSessions.map((x) => x.session_id))
  const signupCount = signupSessions.length
  const heroCount = heroSessions.length
  const paidCount = paidSessions.length

  const signupToPaid =
    signupCount > 0
      ? signupSessions.filter((s) => paidSet.has(s.session_id)).length /
        signupCount
      : 0

  const heroToPaid =
    heroCount > 0
      ? heroSessions.filter((s) => paidSet.has(s.session_id)).length /
        heroCount
      : 0

  return Response.json({
    ok: true,
    mrr,
    arr,
    active_subscriptions: activeSubscriptions,
    churn_rate: churnRate,
    arpu,
    monthly_count: monthlyCount,
    yearly_count: yearlyCount,
    signup_to_paid_rate: signupToPaid,
    hero_to_paid_rate: heroToPaid,
    paid_sessions: paidCount,
  })
}
