/**
 * Parsing des query params GET `/admin/users` → filtres typés pour `buildAdminUsersWhere`.
 * Les allowlists sont définies dans `admin-users-filter-config.ts` (options admin users).
 */
import type { AdminBillingFilterMode, AdminPremiumFilterMode } from "@/lib/admin-users-filter-types"
import type { FeatureKey, PlanKey } from "@/domain/billing/features"
import type { AdminUsersSearchFilters } from "@/lib/admin-users-search-query"
import type { Role, UserStatus } from "@prisma/client"

export type AdminUsersSearchParamsAllowlists = {
  allowedRoles: ReadonlySet<string>
  allowedStatuses: ReadonlySet<string>
  allowedFeatures: ReadonlySet<string>
  allowedPlans: ReadonlySet<string>
}

export type ParsedAdminUsersSearchParams = {
  rawQ: string
  q: string
  roleFilter: Role | undefined
  statusFilter: UserStatus | undefined
  featureFilter: FeatureKey | undefined
  premiumFilter: AdminPremiumFilterMode
  billingFilter: AdminBillingFilterMode
  planFilter: PlanKey | undefined
}

export function readAdminSearchParam(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = sp[key]
  return typeof v === "string" ? v : ""
}

function normalizePremiumFilter(raw: string): AdminPremiumFilterMode {
  const t = raw.trim()
  if (t === "1" || t === "with") return "with"
  if (t === "without") return "without"
  return ""
}

function normalizeBillingFilter(raw: string | undefined): AdminBillingFilterMode {
  const t = typeof raw === "string" ? raw.trim() : ""
  return t === "stripe" || t === "subscribed" || t === "canceling" ? t : ""
}

function safeFeatureFilter(raw: string, allowed: ReadonlySet<string>): FeatureKey | undefined {
  const t = raw.trim()
  if (!t || !allowed.has(t)) return undefined
  return t as FeatureKey
}

function safeRoleFilter(raw: string, allowed: ReadonlySet<string>): Role | undefined {
  const t = raw.trim()
  if (!t || !allowed.has(t)) return undefined
  return t as Role
}

function safeStatusFilter(raw: string, allowed: ReadonlySet<string>): UserStatus | undefined {
  const t = raw.trim()
  if (!t || !allowed.has(t)) return undefined
  return t as UserStatus
}

function safePlanFilter(raw: string, allowed: ReadonlySet<string>): PlanKey | undefined {
  const t = raw.trim()
  if (!t || !allowed.has(t)) return undefined
  return t as PlanKey
}

/**
 * Lit et normalise les search params admin users (valeurs hors whitelist → ignorées).
 */
export function parseAdminUsersSearchParams(
  sp: Record<string, string | string[] | undefined>,
  allowlists: AdminUsersSearchParamsAllowlists,
): ParsedAdminUsersSearchParams {
  const rawQ = readAdminSearchParam(sp, "q")
  const rawRole = readAdminSearchParam(sp, "role")
  const rawStatus = readAdminSearchParam(sp, "status")
  const rawFeature = readAdminSearchParam(sp, "feature")
  const rawPremium = readAdminSearchParam(sp, "premium")
  const rawBilling = readAdminSearchParam(sp, "billing")
  const rawPlan = readAdminSearchParam(sp, "plan")

  return {
    rawQ,
    q: rawQ.trim(),
    roleFilter: safeRoleFilter(rawRole, allowlists.allowedRoles),
    statusFilter: safeStatusFilter(rawStatus, allowlists.allowedStatuses),
    featureFilter: safeFeatureFilter(rawFeature, allowlists.allowedFeatures),
    premiumFilter: normalizePremiumFilter(rawPremium),
    billingFilter: normalizeBillingFilter(rawBilling),
    planFilter: safePlanFilter(rawPlan, allowlists.allowedPlans),
  }
}

export function adminUsersSearchHasActiveCriteria(p: ParsedAdminUsersSearchParams): boolean {
  return Boolean(
    p.q ||
      p.roleFilter ||
      p.statusFilter ||
      p.featureFilter ||
      p.premiumFilter !== "" ||
      p.billingFilter !== "" ||
      p.planFilter,
  )
}

/** Alimente `buildAdminUsersWhere` (clés premium alignées sur les options feature du formulaire). */
export function toAdminUsersSearchFilters(
  p: ParsedAdminUsersSearchParams,
  premiumFeatureKeys: readonly FeatureKey[],
): AdminUsersSearchFilters {
  return {
    q: p.q,
    roleFilter: p.roleFilter,
    statusFilter: p.statusFilter,
    featureFilter: p.featureFilter,
    premiumFilter: p.premiumFilter,
    billingFilter: p.billingFilter,
    planFilter: p.planFilter,
    premiumFeatureKeys,
  }
}
