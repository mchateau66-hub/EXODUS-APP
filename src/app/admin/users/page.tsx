import Link from "next/link"
import { redirect } from "next/navigation"
import { AdminUsersSearchForm } from "@/components/admin/admin-users-search-form"
import {
  AdminUsersResults,
  type AdminUserSearchResult,
} from "@/components/admin/admin-users-results"
import { FEATURE_KEYS, PLAN_KEYS, type FeatureKey, type PlanKey } from "@/domain/billing/features"
import {
  adminUsersSearchHasActiveCriteria,
  parseAdminUsersSearchParams,
  toAdminUsersSearchFilters,
} from "@/lib/admin-users-search-params"
import { ADMIN_USER_SEARCH_TAKE, buildAdminUsersWhere } from "@/lib/admin-users-search-query"
import { prisma } from "@/lib/db"
import { requireOnboardingStep } from "@/lib/onboarding"
import type { Role, UserStatus } from "@prisma/client"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"

/** Valeurs autorisées — alignées sur `enum Role` (schéma Prisma). */
const ADMIN_USER_ROLE_OPTIONS = ["coach", "athlete", "admin"] as const satisfies readonly Role[]

/** Valeurs autorisées — alignées sur `enum UserStatus`. */
const ADMIN_USER_STATUS_OPTIONS = ["active", "disabled", "deleted"] as const satisfies readonly UserStatus[]

const ALLOWED_ROLES = new Set<string>(ADMIN_USER_ROLE_OPTIONS)
const ALLOWED_STATUSES = new Set<string>(ADMIN_USER_STATUS_OPTIONS)

/** Whitelist features premium — alignées sur les clés produit et `userHasFeature`. */
const ADMIN_USER_FEATURE_OPTIONS = [
  { value: FEATURE_KEYS.messagesUnlimited, label: "Messages illimités" },
  { value: FEATURE_KEYS.contactUnlock, label: "Déverrouillage de contact" },
  { value: FEATURE_KEYS.coachPriorityListing, label: "Mise en avant du profil coach" },
  { value: FEATURE_KEYS.profileBoost, label: "Boost du profil" },
  { value: FEATURE_KEYS.searchPriority, label: "Priorité dans les résultats de recherche" },
] as const satisfies readonly { value: FeatureKey; label: string }[]

const ALLOWED_ADMIN_FEATURES = new Set<string>(ADMIN_USER_FEATURE_OPTIONS.map((o) => o.value))

/** Mêmes clés que le filtre feature — entitlements actifs pour les modes `premium=with` / `without`. */
const PREMIUM_FEATURE_KEYS = ADMIN_USER_FEATURE_OPTIONS.map((o) => o.value)

/** Plans proposés dans l’admin — alignés sur `PLAN_KEYS` (vérité produit). */
const ADMIN_USER_PLAN_OPTIONS = [
  { value: PLAN_KEYS.free, label: "Free" },
  { value: PLAN_KEYS.athletePremium, label: "Athlète premium" },
  { value: PLAN_KEYS.coachPremium, label: "Coach premium" },
] as const satisfies readonly { value: PlanKey; label: string }[]

const ALLOWED_PLAN_KEYS = new Set<string>(ADMIN_USER_PLAN_OPTIONS.map((o) => o.value))

type PageProps = {
  searchParams?: Promise<{
    q?: string
    role?: string
    status?: string
    feature?: string
    premium?: string
    billing?: string
    plan?: string
  }>
}

export default async function AdminUsersIndexPage({ searchParams }: PageProps) {
  if (process.env.FEATURE_ADMIN_DASHBOARD === "0") redirect("/hub")

  const session = await requireOnboardingStep(3)
  const user = session.user as { role?: string }
  if (user?.role !== "admin") redirect("/hub")

  const sp = (await searchParams) ?? {}
  const parsed = parseAdminUsersSearchParams(sp, {
    allowedRoles: ALLOWED_ROLES,
    allowedStatuses: ALLOWED_STATUSES,
    allowedFeatures: ALLOWED_ADMIN_FEATURES,
    allowedPlans: ALLOWED_PLAN_KEYS,
  })
  const {
    rawQ,
    q,
    roleFilter,
    statusFilter,
    featureFilter,
    premiumFilter,
    billingFilter,
    planFilter,
  } = parsed

  const hasActiveCriteria = adminUsersSearchHasActiveCriteria(parsed)

  const now = new Date()

  let results: AdminUserSearchResult[] = []
  let searchError = false

  if (hasActiveCriteria) {
    try {
      const where = buildAdminUsersWhere(
        toAdminUsersSearchFilters(parsed, PREMIUM_FEATURE_KEYS),
        now,
      )

      const rows = await prisma.user.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: ADMIN_USER_SEARCH_TAKE,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          created_at: true,
          coach: { select: { slug: true } },
        },
      })

      results = rows.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        status: row.status,
        created_at: row.created_at,
        coachSlug: row.coach?.slug ?? null,
      }))
    } catch (error) {
      console.error("admin_users_search_failed", { error })
      searchError = true
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Admin</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text)]">Utilisateurs</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Recherchez un utilisateur pour ouvrir sa fiche admin.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/verification"
              className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-muted)]"
            >
              Vérification coachs
            </Link>
            <Link
              href="/hub"
              className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
            >
              Hub
            </Link>
          </div>
        </div>

        <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-bg)] p-4 shadow-[var(--card-shadow)] md:p-6">
          <AdminUsersSearchForm
            q={rawQ}
            role={roleFilter ?? ""}
            status={statusFilter ?? ""}
            feature={featureFilter ?? ""}
            premium={premiumFilter}
            billing={billingFilter}
            plan={planFilter ?? ""}
            roleOptions={[...ADMIN_USER_ROLE_OPTIONS]}
            statusOptions={[...ADMIN_USER_STATUS_OPTIONS]}
            featureOptions={[...ADMIN_USER_FEATURE_OPTIONS]}
            planOptions={[...ADMIN_USER_PLAN_OPTIONS]}
          />
        </div>

        <div className="mt-6">
          <h2 className="sr-only">Résultats</h2>
          <AdminUsersResults
            queryTrimmed={q}
            appliedRole={roleFilter ?? null}
            appliedStatus={statusFilter ?? null}
            appliedFeature={featureFilter ?? null}
            premiumFilter={premiumFilter}
            billingFilter={billingFilter}
            appliedPlan={planFilter ?? null}
            hasActiveCriteria={hasActiveCriteria}
            results={results}
            searchError={searchError}
          />
        </div>
      </div>
    </main>
  )
}
