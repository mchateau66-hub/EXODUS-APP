import Link from "next/link"
import { redirect } from "next/navigation"
import { AdminUsersSearchForm, type AdminPremiumFilterMode } from "@/components/admin/admin-users-search-form"
import {
  AdminUsersResults,
  type AdminUserSearchResult,
} from "@/components/admin/admin-users-results"
import { FEATURE_KEYS, type FeatureKey } from "@/domain/billing/features"
import { prisma } from "@/lib/db"
import { requireOnboardingStep } from "@/lib/onboarding"
import type { Prisma, Role, UserStatus } from "@prisma/client"

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

function normalizePremiumFilter(raw: string): AdminPremiumFilterMode {
  const t = raw.trim()
  if (t === "1" || t === "with") return "with"
  if (t === "without") return "without"
  return ""
}

function safeFeatureFilter(raw: string): FeatureKey | undefined {
  const t = raw.trim()
  if (!t || !ALLOWED_ADMIN_FEATURES.has(t)) return undefined
  return t as FeatureKey
}

function safeRoleFilter(raw: string): Role | undefined {
  const t = raw.trim()
  if (!t || !ALLOWED_ROLES.has(t)) return undefined
  return t as Role
}

function safeStatusFilter(raw: string): UserStatus | undefined {
  const t = raw.trim()
  if (!t || !ALLOWED_STATUSES.has(t)) return undefined
  return t as UserStatus
}

type PageProps = {
  searchParams?: Promise<{ q?: string; role?: string; status?: string; feature?: string; premium?: string }>
}

export default async function AdminUsersIndexPage({ searchParams }: PageProps) {
  if (process.env.FEATURE_ADMIN_DASHBOARD === "0") redirect("/hub")

  const session = await requireOnboardingStep(3)
  const user = session.user as { role?: string }
  if (user?.role !== "admin") redirect("/hub")

  const sp = (await searchParams) ?? {}
  const rawQ = typeof sp.q === "string" ? sp.q : ""
  const rawRole = typeof sp.role === "string" ? sp.role : ""
  const rawStatus = typeof sp.status === "string" ? sp.status : ""
  const rawFeature = typeof sp.feature === "string" ? sp.feature : ""
  const rawPremium = typeof sp.premium === "string" ? sp.premium : ""

  const q = rawQ.trim()
  const roleFilter = safeRoleFilter(rawRole)
  const statusFilter = safeStatusFilter(rawStatus)
  const featureFilter = safeFeatureFilter(rawFeature)
  const premiumFilter = normalizePremiumFilter(rawPremium)

  const hasActiveCriteria = Boolean(q || roleFilter || statusFilter || featureFilter || premiumFilter !== "")

  const now = new Date()

  let results: AdminUserSearchResult[] = []
  let searchError = false

  if (hasActiveCriteria) {
    try {
      const activeEntitlement: Pick<
        Prisma.UserEntitlementWhereInput,
        "starts_at" | "OR"
      > = {
        starts_at: { lte: now },
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      }

      const andClauses: Prisma.UserWhereInput[] = []

      if (q) {
        andClauses.push({
          OR: [
            { id: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { coach: { slug: { contains: q, mode: "insensitive" } } },
          ],
        })
      }

      if (roleFilter) andClauses.push({ role: roleFilter })
      if (statusFilter) andClauses.push({ status: statusFilter })

      if (featureFilter) {
        andClauses.push({
          entitlements: {
            some: {
              feature_key: featureFilter,
              ...activeEntitlement,
            },
          },
        })
      }

      if (premiumFilter === "with") {
        andClauses.push({
          entitlements: {
            some: {
              feature_key: { in: [...PREMIUM_FEATURE_KEYS] },
              ...activeEntitlement,
            },
          },
        })
      }

      if (premiumFilter === "without") {
        andClauses.push({
          NOT: {
            entitlements: {
              some: {
                feature_key: { in: [...PREMIUM_FEATURE_KEYS] },
                ...activeEntitlement,
              },
            },
          },
        })
      }

      const where: Prisma.UserWhereInput = andClauses.length > 0 ? { AND: andClauses } : {}

      const rows = await prisma.user.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: 20,
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
            roleOptions={[...ADMIN_USER_ROLE_OPTIONS]}
            statusOptions={[...ADMIN_USER_STATUS_OPTIONS]}
            featureOptions={[...ADMIN_USER_FEATURE_OPTIONS]}
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
            hasActiveCriteria={hasActiveCriteria}
            results={results}
            searchError={searchError}
          />
        </div>
      </div>
    </main>
  )
}
