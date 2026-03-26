// prisma/seed.plans_features.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 🔑 Clés de plans (copie locale pour le seed)
const PLAN_KEYS = {
  free: 'free',
  athletePremium: 'athlete_premium',
  coachPremium: 'coach_premium',
} as const

type PlanKey = (typeof PLAN_KEYS)[keyof typeof PLAN_KEYS]

// 🔑 Clés de features (copie locale pour le seed)
const FEATURE_KEYS = {
  messagesUnlimited: 'messages.unlimited',
  messagesFreeTrial: 'messages.free_trial',
  coachProDashboard: 'coach.pro_dashboard',
  coachUnlimitedAthletes: 'coach.unlimited_athletes',
  coachExternalAppLink: 'coach.external_app_link',
} as const

type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS]

export async function seedPlansFeatures() {
  try {
  // 1) Plans
  const plans: { key: PlanKey; name: string }[] = [
    {
      key: PLAN_KEYS.free,
      name: 'Free',
    },
    {
      key: PLAN_KEYS.athletePremium,
      name: 'Athlète Premium',
    },
    {
      key: PLAN_KEYS.coachPremium,
      name: 'Coach Premium',
    },
  ]

  for (const p of plans) {
    await prisma.plan.upsert({
      where: { key: p.key },
      update: {
        name: p.name,
        active: true,
      },
      create: {
        key: p.key,
        name: p.name,
        active: true,
      },
    })
  }

  // 2) Features
  const features: { key: FeatureKey; description: string }[] = [
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
      create: f,
    })
  }

  // 3) PlanFeatures
  const links: { plan_key: PlanKey; feature_key: FeatureKey }[] = [
    // Free : à activer si tu veux un entitlement explicite pour le trial
    // {
    //   plan_key: PLAN_KEYS.free,
    //   feature_key: FEATURE_KEYS.messagesFreeTrial,
    // },

    // Athlète Premium → messagerie illimitée
    {
      plan_key: PLAN_KEYS.athletePremium,
      feature_key: FEATURE_KEYS.messagesUnlimited,
    },

    // Coach Premium → pipeline complet + illimité + app externe
    {
      plan_key: PLAN_KEYS.coachPremium,
      feature_key: FEATURE_KEYS.coachProDashboard,
    },
    {
      plan_key: PLAN_KEYS.coachPremium,
      feature_key: FEATURE_KEYS.coachUnlimitedAthletes,
    },
    {
      plan_key: PLAN_KEYS.coachPremium,
      feature_key: FEATURE_KEYS.coachExternalAppLink,
    },
  ]

  for (const link of links) {
    await prisma.planFeature.upsert({
      where: {
        // suppose @@unique([plan_key, feature_key], name: "plan_key_feature_key")
        plan_key_feature_key: {
          plan_key: link.plan_key,
          feature_key: link.feature_key,
        },
      },
      update: {},
      create: link,
    })
  }

  console.log('✅ Plans & features seeded')
  } finally {
    await prisma.$disconnect()
  }
}

const runDirect =
  typeof process.argv[1] === "string" &&
  (process.argv[1].includes("seed.plans_features") || process.argv[1].endsWith("seed.plans_features.ts"))

if (runDirect) {
  seedPlansFeatures().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
