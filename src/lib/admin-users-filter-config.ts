/**
 * Source de vérité pour les filtres admin `/admin/users` : valeurs autorisées, options de
 * formulaire, libellés récap (résultats) et allowlists de parsing. Toute évolution des choix
 * affichés doit passer par ce module pour éviter la dérive entre UI, `parseAdminUsersSearchParams`
 * et `buildAdminUsersWhere`.
 */
import { FEATURE_KEYS, PLAN_KEYS, type FeatureKey, type PlanKey } from "@/domain/billing/features"
import type { AdminBillingFilterMode, AdminPremiumFilterMode } from "@/lib/admin-users-filter-types"
import type { AdminUsersSearchParamsAllowlists } from "@/lib/admin-users-search-params"
import type { Role, UserStatus } from "@prisma/client"

export const ADMIN_USER_ROLE_OPTIONS = ["coach", "athlete", "admin"] as const satisfies readonly Role[]

export const ADMIN_USER_STATUS_OPTIONS = ["active", "disabled", "deleted"] as const satisfies readonly UserStatus[]

export const ADMIN_USER_FEATURE_OPTIONS = [
  { value: FEATURE_KEYS.messagesUnlimited, label: "Messages illimités" },
  { value: FEATURE_KEYS.contactUnlock, label: "Déverrouillage de contact" },
  { value: FEATURE_KEYS.coachPriorityListing, label: "Mise en avant du profil coach" },
  { value: FEATURE_KEYS.profileBoost, label: "Boost du profil" },
  { value: FEATURE_KEYS.searchPriority, label: "Priorité dans les résultats de recherche" },
] as const satisfies readonly { value: FeatureKey; label: string }[]

export const ADMIN_USER_PLAN_OPTIONS = [
  { value: PLAN_KEYS.free, label: "Free" },
  { value: PLAN_KEYS.athletePremium, label: "Athlète premium" },
  { value: PLAN_KEYS.coachPremium, label: "Coach premium" },
] as const satisfies readonly { value: PlanKey; label: string }[]

/** Clés entitlements premium — alignées sur `ADMIN_USER_FEATURE_OPTIONS`. */
export const ADMIN_USER_PREMIUM_FEATURE_KEYS: readonly FeatureKey[] = ADMIN_USER_FEATURE_OPTIONS.map((o) => o.value)

/** Libellés filtre feature pour le récap « filtres actifs » (résultats). */
export const ADMIN_USER_FEATURE_FILTER_LABEL: Partial<Record<FeatureKey, string>> = Object.fromEntries(
  ADMIN_USER_FEATURE_OPTIONS.map((o) => [o.value, o.label]),
)

/** Libellés forfait pour le récap — alignés sur `ADMIN_USER_PLAN_OPTIONS`. */
export const ADMIN_USER_PLAN_FILTER_LABEL: Record<PlanKey, string> = Object.fromEntries(
  ADMIN_USER_PLAN_OPTIONS.map((o) => [o.value, o.label]),
) as Record<PlanKey, string>

/** Libellés récap « filtres actifs » — premium (texte distinct des libellés du formulaire). */
export const ADMIN_USER_PREMIUM_FILTER_SUMMARY_LABELS = {
  with: "droits premium actifs (fonctionnalités)",
  without: "sans droits premium actifs",
} as const

/** Libellés récap « filtres actifs » — facturation Stripe. */
export const ADMIN_USER_BILLING_FILTER_SUMMARY_LABELS = {
  stripe: "client Stripe renseigné",
  subscribed: "abonnement Stripe : actif, essai ou impayé léger",
  canceling: "résiliation à l’échéance",
} as const

/** Options `<select name="premium">` — valeurs = paramètres d’URL acceptés par le parser. */
export const ADMIN_USER_PREMIUM_FORM_OPTIONS = [
  { value: "", label: "Tous les utilisateurs" },
  { value: "with", label: "Avec au moins une fonctionnalité premium" },
  { value: "without", label: "Sans fonctionnalité premium active" },
] as const satisfies readonly { value: AdminPremiumFilterMode; label: string }[]

/** Options `<select name="billing">`. */
export const ADMIN_USER_BILLING_FORM_OPTIONS = [
  { value: "", label: "Tous les états" },
  { value: "stripe", label: "Avec client Stripe" },
  { value: "subscribed", label: "Abonnement actif, essai ou impayé léger" },
  { value: "canceling", label: "Résiliation à l’échéance" },
] as const satisfies readonly { value: AdminBillingFilterMode; label: string }[]

/** Allowlists alignées sur les options affichées — entrée de `parseAdminUsersSearchParams`. */
export const ADMIN_USER_SEARCH_PARAM_ALLOWLISTS: AdminUsersSearchParamsAllowlists = {
  allowedRoles: new Set<string>(ADMIN_USER_ROLE_OPTIONS),
  allowedStatuses: new Set<string>(ADMIN_USER_STATUS_OPTIONS),
  allowedFeatures: new Set<string>(ADMIN_USER_FEATURE_OPTIONS.map((o) => o.value)),
  allowedPlans: new Set<string>(ADMIN_USER_PLAN_OPTIONS.map((o) => o.value)),
}
