// prisma/seed.ts
import { PrismaClient } from '@prisma/client'

console.log('🚨 SEED FILE LOADED', new Date().toISOString())
const prisma = new PrismaClient()


// 🔑 Clés de plans (source unique de vérité pour le seed)
const PLAN_KEYS = {
  free: 'free',
  athletePremium: 'athlete_premium',
  coachPremium: 'coach_premium',
} as const

type PlanKey = (typeof PLAN_KEYS)[keyof typeof PLAN_KEYS]

// 🔑 Clés de features (source unique de vérité pour le seed)
const FEATURE_KEYS = {
  messagesUnlimited: 'messages.unlimited',
  messagesFreeTrial: 'messages.free_trial',
  coachProDashboard: 'coach.pro_dashboard',
  coachUnlimitedAthletes: 'coach.unlimited_athletes',
  coachExternalAppLink: 'coach.external_app_link',
} as const

type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS]

function envOrNull(key: string): string | null {
  const v = process.env[key]
  return v && v.trim().length > 0 ? v : null
}

async function main() {
  // 1) Plans (upsert = idempotent + met à jour Stripe IDs si changent)
  const plans: Array<{
    key: PlanKey
    name: string
    stripe_price_id_monthly: string | null
    stripe_price_id_yearly: string | null
  }> = [
    {
      key: PLAN_KEYS.free,
      name: 'Free',
      stripe_price_id_monthly: null,
      stripe_price_id_yearly: null,
    },
    {
      key: PLAN_KEYS.athletePremium,
      name: 'Athlete Premium',
      stripe_price_id_monthly: envOrNull('STRIPE_PRICE_ATHLETE_PREMIUM_MONTHLY'),
      stripe_price_id_yearly: envOrNull('STRIPE_PRICE_ATHLETE_PREMIUM_YEARLY'),
    },
    {
      key: PLAN_KEYS.coachPremium,
      name: 'Coach Premium',
      stripe_price_id_monthly: envOrNull('STRIPE_PRICE_COACH_PREMIUM_MONTHLY'),
      stripe_price_id_yearly: envOrNull('STRIPE_PRICE_COACH_PREMIUM_YEARLY'),
    },
  ]

  for (const p of plans) {
    await prisma.plan.upsert({
      where: { key: p.key },
      update: {
        name: p.name,
        active: true,
        stripe_price_id_monthly: p.stripe_price_id_monthly,
        stripe_price_id_yearly: p.stripe_price_id_yearly,
      },
      create: {
        key: p.key,
        name: p.name,
        active: true,
        stripe_price_id_monthly: p.stripe_price_id_monthly,
        stripe_price_id_yearly: p.stripe_price_id_yearly,
      },
    })
  }

  // 2) Features (upsert = idempotent)
  const features: Array<{ key: FeatureKey; description: string }> = [
    {
      key: FEATURE_KEYS.messagesUnlimited,
      description: 'Messagerie illimitée pour les athlètes premium',
    },
    {
      key: FEATURE_KEYS.messagesFreeTrial,
      description: 'Accès temporaire à la messagerie (offre gratuite)',
    },
    {
      key: FEATURE_KEYS.coachProDashboard,
      description: 'Dashboard coach complet (pipeline + filtres avancés)',
    },
    {
      key: FEATURE_KEYS.coachUnlimitedAthletes,
      description: 'Nombre d’athlètes actifs illimité pour le coach',
    },
    {
      key: FEATURE_KEYS.coachExternalAppLink,
      description: 'Lien vers l’app de coaching externe du coach',
    },
  ]

  for (const f of features) {
    await prisma.feature.upsert({
      where: { key: f.key },
      update: { description: f.description },
      create: { key: f.key, description: f.description },
    })
  }

  // 3) PlanFeatures (createMany + skipDuplicates = robuste + rapide)
  const links: Array<{ plan_key: PlanKey; feature_key: FeatureKey }> = [
    // Optionnel : trial explicite sur Free
    // { plan_key: PLAN_KEYS.free, feature_key: FEATURE_KEYS.messagesFreeTrial },

    // Athlète Premium → messagerie illimitée
    { plan_key: PLAN_KEYS.athletePremium, feature_key: FEATURE_KEYS.messagesUnlimited },

    // Coach Premium → dashboard + illimité + app externe
    { plan_key: PLAN_KEYS.coachPremium, feature_key: FEATURE_KEYS.coachProDashboard },
    { plan_key: PLAN_KEYS.coachPremium, feature_key: FEATURE_KEYS.coachUnlimitedAthletes },
    { plan_key: PLAN_KEYS.coachPremium, feature_key: FEATURE_KEYS.coachExternalAppLink },
  ]

  await prisma.planFeature.createMany({
    data: links,
    skipDuplicates: true,
  })

  console.log('✅ Seed completed: Plans + Features + PlanFeatures')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })