// src/domain/billing/features.ts

// 🔑 Toutes les clés de features centralisées
export const FEATURE_KEYS = {
  messagesUnlimited: 'messages.unlimited',
  messagesFreeTrial: 'messages.free_trial',
  coachProDashboard: 'coach.pro_dashboard',
  coachUnlimitedAthletes: 'coach.unlimited_athletes',
  coachExternalAppLink: 'coach.external_app_link',
} as const

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS]

// 🔑 Toutes les clés de plans centralisées
export const PLAN_KEYS = {
  free: 'free',
  athletePremium: 'athlete_premium',
  coachPremium: 'coach_premium',
} as const

export type PlanKey = (typeof PLAN_KEYS)[keyof typeof PLAN_KEYS]

// Petites aides si besoin plus tard
export const ATHLETE_FEATURES: FeatureKey[] = [
  FEATURE_KEYS.messagesUnlimited,
  FEATURE_KEYS.messagesFreeTrial,
]

export const COACH_FEATURES: FeatureKey[] = [
  FEATURE_KEYS.coachProDashboard,
  FEATURE_KEYS.coachUnlimitedAthletes,
  FEATURE_KEYS.coachExternalAppLink,
]
