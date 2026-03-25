import Link from "next/link"
import type { Role, UserStatus } from "@prisma/client"
import { FEATURE_KEYS, PLAN_KEYS, type FeatureKey, type PlanKey } from "@/domain/billing/features"
import type { AdminBillingFilterMode, AdminPremiumFilterMode } from "@/components/admin/admin-users-search-form"
import { ADMIN_USER_ROLE_LABEL, ADMIN_USER_STATUS_LABEL } from "@/components/admin/admin-users-labels"

export type AdminUserSearchResult = {
  id: string
  email: string | null
  name: string | null
  role: string
  status: string
  created_at: Date
  coachSlug: string | null
}

const PREMIUM_FILTER_LABELS: Record<Exclude<AdminPremiumFilterMode, "">, string> = {
  with: "droits premium actifs (fonctionnalités)",
  without: "sans droits premium actifs",
}

const BILLING_FILTER_LABELS: Record<Exclude<AdminBillingFilterMode, "">, string> = {
  stripe: "client Stripe renseigné",
  subscribed: "abonnement Stripe : actif, essai ou impayé léger",
  canceling: "résiliation à l’échéance",
}

/** Libellés pour le filtre admin feature (whitelist recherche utilisateurs). */
const FEATURE_FILTER_LABEL: Partial<Record<FeatureKey, string>> = {
  [FEATURE_KEYS.messagesUnlimited]: "Messages illimités",
  [FEATURE_KEYS.contactUnlock]: "Déverrouillage de contact",
  [FEATURE_KEYS.coachPriorityListing]: "Mise en avant du profil coach",
  [FEATURE_KEYS.profileBoost]: "Boost du profil",
  [FEATURE_KEYS.searchPriority]: "Priorité dans les résultats de recherche",
}

const PLAN_FILTER_LABEL: Record<PlanKey, string> = {
  [PLAN_KEYS.free]: "Free",
  [PLAN_KEYS.athletePremium]: "Athlète premium",
  [PLAN_KEYS.coachPremium]: "Coach premium",
}

type AdminUsersResultsProps = {
  queryTrimmed: string
  appliedRole: Role | null
  appliedStatus: UserStatus | null
  appliedFeature: FeatureKey | null
  premiumFilter: AdminPremiumFilterMode
  billingFilter: AdminBillingFilterMode
  appliedPlan: PlanKey | null
  hasActiveCriteria: boolean
  results: AdminUserSearchResult[]
  searchError: boolean
}

function ActiveFiltersSummaryLine({ chips, queryTrimmed }: { chips: string[]; queryTrimmed: string }) {
  if (chips.length === 0 && !queryTrimmed) return null
  return (
    <p
      className="text-xs text-[var(--text-muted)]"
      data-testid="admin-users-results-summary"
    >
      {chips.length > 0 ? <span>Filtres actifs : {chips.join(", ")}</span> : null}
      {chips.length > 0 && queryTrimmed ? <span className="mx-2 text-[var(--border)]">·</span> : null}
      {queryTrimmed ? <span>recherche « {queryTrimmed} »</span> : null}
    </p>
  )
}

function formatCreatedAt(d: Date): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d)
  } catch {
    return d.toISOString()
  }
}

export function AdminUsersResults({
  queryTrimmed,
  appliedRole,
  appliedStatus,
  appliedFeature,
  premiumFilter,
  billingFilter,
  appliedPlan,
  hasActiveCriteria,
  results,
  searchError,
}: AdminUsersResultsProps) {
  const filterChips: string[] = []
  if (appliedRole) filterChips.push(`rôle ${ADMIN_USER_ROLE_LABEL[appliedRole]}`)
  if (appliedStatus) filterChips.push(`statut ${ADMIN_USER_STATUS_LABEL[appliedStatus]}`)
  if (appliedFeature) {
    const fl = FEATURE_FILTER_LABEL[appliedFeature]
    filterChips.push(`fonctionnalité ${fl ?? appliedFeature}`)
  }
  if (premiumFilter === "with" || premiumFilter === "without") {
    filterChips.push(PREMIUM_FILTER_LABELS[premiumFilter])
  }
  if (billingFilter === "stripe" || billingFilter === "subscribed" || billingFilter === "canceling") {
    filterChips.push(BILLING_FILTER_LABELS[billingFilter])
  }
  if (appliedPlan) {
    filterChips.push(`forfait Stripe « ${PLAN_FILTER_LABEL[appliedPlan]} »`)
  }

  if (searchError) {
    return (
      <div
        className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-bg)] p-5 text-sm text-[var(--text)] shadow-[var(--card-shadow)]"
        role="alert"
      >
        Une erreur technique est survenue lors de la recherche. Réessayez dans un instant ou contactez l’équipe technique.
      </div>
    )
  }

  if (!hasActiveCriteria) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        Recherchez un utilisateur par e-mail, identifiant ou slug, puis affinez par rôle, statut, fonctionnalités premium
        (entitlements), facturation Stripe ou forfait. Le forfait utilise les mêmes statuts d’abonnement que l’option
        « Abonnement actif, essai ou impayé léger » ci-dessus.
      </p>
    )
  }

  if (results.length === 0) {
    return (
      <div className="space-y-2">
        {filterChips.length > 0 || queryTrimmed ? (
          <p className="text-xs text-[var(--text-muted)]">
            {filterChips.length > 0 ? <span>Filtres actifs : {filterChips.join(", ")}</span> : null}
            {filterChips.length > 0 && queryTrimmed ? <span className="mx-2 text-[var(--border)]">·</span> : null}
            {queryTrimmed ? <span>recherche « {queryTrimmed} »</span> : null}
          </p>
        ) : null}
        <p className="text-sm text-[var(--text-muted)]">
          Aucun utilisateur ne correspond aux critères sélectionnés.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ActiveFiltersSummaryLine chips={filterChips} queryTrimmed={queryTrimmed} />
      <ul className="space-y-3">
        {results.map((u) => (
          <li
            key={u.id}
            className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-bg)] p-4 shadow-[var(--card-shadow)] md:p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-semibold text-[var(--text)]">
                  {u.name?.trim() ? u.name : "Non renseigné"}
                </p>
                <p className="truncate text-sm text-[var(--text-muted)]">
                  {u.email?.trim() ? (
                    <span className="break-all">{u.email}</span>
                  ) : (
                    "Non renseigné"
                  )}
                </p>
                <p className="break-all font-mono text-xs text-[var(--text-muted)]">id: {u.id}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                  <span>
                    rôle: <span className="text-[var(--text)]">{u.role}</span>
                  </span>
                  <span>
                    statut: <span className="text-[var(--text)]">{u.status}</span>
                  </span>
                  <span>créé: {formatCreatedAt(u.created_at)}</span>
                  {u.coachSlug?.trim() ? (
                    <span>
                      slug coach: <span className="text-[var(--text)]">{u.coachSlug}</span>
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 sm:pt-0.5">
                <Link
                  href={`/admin/users/${u.id}`}
                  className="text-sm text-[var(--text-muted)] underline underline-offset-4 hover:underline focus-visible:rounded-[var(--radius-md)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border)]"
                >
                  Voir la fiche admin
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
