import Link from "next/link"
import type { Role, UserStatus } from "@prisma/client"
import type { FeatureKey, PlanKey } from "@/domain/billing/features"
import type { AdminBillingFilterMode, AdminPremiumFilterMode } from "@/lib/admin-users-filter-types"
import { ADMIN_USER_ROLE_LABEL, ADMIN_USER_STATUS_LABEL } from "@/components/admin/admin-users-labels"
import {
  ADMIN_USER_BILLING_FILTER_SUMMARY_LABELS,
  ADMIN_USER_FEATURE_FILTER_LABEL,
  ADMIN_USER_PLAN_FILTER_LABEL,
  ADMIN_USER_PREMIUM_FILTER_SUMMARY_LABELS,
} from "@/lib/admin-users-filter-config"
import { ADMIN_USER_SEARCH_TAKE } from "@/lib/admin-users-search-query"

export type AdminUserSearchResult = {
  id: string
  email: string | null
  name: string | null
  role: string
  status: string
  created_at: Date
  coachSlug: string | null
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
  /** Nombre total d’utilisateurs correspondant au `where` (null si recherche non lancée ou erreur). */
  totalMatchingCount: number | null
  currentPage: number
  totalPages: number
  prevHref: string | null
  nextHref: string | null
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

function ResultsCountLine({
  displayed,
  total,
  takeLimit,
  page,
}: {
  displayed: number
  total: number
  takeLimit: number
  page: number
}) {
  const noun = total <= 1 ? "utilisateur" : "utilisateurs"
  const verb = total <= 1 ? "correspond" : "correspondent"
  const start = (page - 1) * takeLimit + 1
  const end = (page - 1) * takeLimit + displayed

  return (
    <div className="space-y-1" data-testid="admin-users-results-count">
      <p className="text-sm font-medium text-[var(--text)]">
        {start}–{end} sur {total} {noun} {verb} aux filtres
      </p>
    </div>
  )
}

function PaginationNav({
  currentPage,
  totalPages,
  prevHref,
  nextHref,
}: {
  currentPage: number
  totalPages: number
  prevHref: string | null
  nextHref: string | null
}) {
  if (totalPages <= 1) return null

  const linkClass =
    "inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-1.5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-muted)]"
  const disabledClass =
    "inline-flex cursor-not-allowed items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] opacity-70"

  return (
    <nav
      aria-label="Pagination des résultats"
      className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3"
      data-testid="admin-users-results-pagination"
    >
      {prevHref ? (
        <Link href={prevHref} className={linkClass}>
          Précédent
        </Link>
      ) : (
        <span className={disabledClass}>Précédent</span>
      )}
      <span className="text-sm text-[var(--text-muted)]">
        Page {currentPage} / {totalPages}
      </span>
      {nextHref ? (
        <Link href={nextHref} className={linkClass}>
          Suivant
        </Link>
      ) : (
        <span className={disabledClass}>Suivant</span>
      )}
    </nav>
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
  totalMatchingCount,
  currentPage,
  totalPages,
  prevHref,
  nextHref,
}: AdminUsersResultsProps) {
  const filterChips: string[] = []
  if (appliedRole) filterChips.push(`rôle ${ADMIN_USER_ROLE_LABEL[appliedRole]}`)
  if (appliedStatus) filterChips.push(`statut ${ADMIN_USER_STATUS_LABEL[appliedStatus]}`)
  if (appliedFeature) {
    const fl = ADMIN_USER_FEATURE_FILTER_LABEL[appliedFeature]
    filterChips.push(`fonctionnalité ${fl ?? appliedFeature}`)
  }
  if (premiumFilter === "with" || premiumFilter === "without") {
    filterChips.push(ADMIN_USER_PREMIUM_FILTER_SUMMARY_LABELS[premiumFilter])
  }
  if (billingFilter === "stripe" || billingFilter === "subscribed" || billingFilter === "canceling") {
    filterChips.push(ADMIN_USER_BILLING_FILTER_SUMMARY_LABELS[billingFilter])
  }
  if (appliedPlan) {
    filterChips.push(`forfait Stripe « ${ADMIN_USER_PLAN_FILTER_LABEL[appliedPlan]} »`)
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
        <ActiveFiltersSummaryLine chips={filterChips} queryTrimmed={queryTrimmed} />
        <p className="text-sm text-[var(--text-muted)]">
          Aucun utilisateur ne correspond aux critères sélectionnés.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ActiveFiltersSummaryLine chips={filterChips} queryTrimmed={queryTrimmed} />
      {totalMatchingCount !== null ? (
        <ResultsCountLine
          displayed={results.length}
          total={totalMatchingCount}
          takeLimit={ADMIN_USER_SEARCH_TAKE}
          page={currentPage}
        />
      ) : null}
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
      {!searchError && totalMatchingCount !== null ? (
        <PaginationNav
          currentPage={currentPage}
          totalPages={totalPages}
          prevHref={prevHref}
          nextHref={nextHref}
        />
      ) : null}
    </div>
  )
}
