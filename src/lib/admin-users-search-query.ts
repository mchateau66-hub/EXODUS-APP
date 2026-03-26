/**
 * Construction de `Prisma.UserWhereInput` pour la recherche admin `/admin/users`.
 * Les valeurs doivent être déjà normalisées / whitelistées (voir `admin-users-search-params.ts`).
 *
 * Fusion `billing` + `plan` :
 * - `subscribed` + plan : souscription avec ce `plan_key` et statut « pertinent » (active/trialing/past_due).
 * - `canceling` + plan : souscription avec ce `plan_key` et `cancel_at_period_end`.
 * - Sinon, `subscribed` / `canceling` / `plan` seuls appliquent chacune leur branche (plan seul = même
 *   notion d’abonnement pertinent que pour `billing=subscribed`).
 */
import type { AdminBillingFilterMode, AdminPremiumFilterMode } from "@/lib/admin-users-filter-types"
import type { FeatureKey, PlanKey } from "@/domain/billing/features"
import type { Prisma, Role, SubStatus, UserStatus } from "@prisma/client"

/** Statuts d’abonnement Stripe/Prisma encore pertinents côté support (« abonné » ou équivalent). */
const SUBSCRIBED_SUB_STATUSES = ["active", "trialing", "past_due"] as const satisfies readonly SubStatus[]

const SUBSCRIBED_SUBSCRIPTION_STATUSES: SubStatus[] = [...SUBSCRIBED_SUB_STATUSES]

export const ADMIN_USER_SEARCH_TAKE = 20

/** Filtres parsés et sûrs — entrée de `buildAdminUsersWhere`. */
export type AdminUsersSearchFilters = {
  q: string
  roleFilter: Role | undefined
  statusFilter: UserStatus | undefined
  featureFilter: FeatureKey | undefined
  premiumFilter: AdminPremiumFilterMode
  billingFilter: AdminBillingFilterMode
  planFilter: PlanKey | undefined
  /** Mêmes clés que le filtre feature — entitlements actifs pour `premium=with` / `without`. */
  premiumFeatureKeys: readonly FeatureKey[]
}

export function buildAdminUsersWhere(
  filters: AdminUsersSearchFilters,
  now: Date,
): Prisma.UserWhereInput {
  const {
    q,
    roleFilter,
    statusFilter,
    featureFilter,
    premiumFilter,
    billingFilter,
    planFilter,
    premiumFeatureKeys,
  } = filters

  const activeEntitlement: Pick<Prisma.UserEntitlementWhereInput, "starts_at" | "OR"> = {
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
          feature_key: { in: [...premiumFeatureKeys] },
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
            feature_key: { in: [...premiumFeatureKeys] },
            ...activeEntitlement,
          },
        },
      },
    })
  }

  if (billingFilter === "stripe") {
    andClauses.push({
      AND: [{ stripe_customer_id: { not: null } }, { NOT: { stripe_customer_id: "" } }],
    })
  }

  const mergedSubscribedPlan = billingFilter === "subscribed" && planFilter
  const mergedCancelingPlan = billingFilter === "canceling" && planFilter

  if (mergedSubscribedPlan) {
    andClauses.push({
      subscriptions: {
        some: {
          plan_key: planFilter,
          status: { in: SUBSCRIBED_SUBSCRIPTION_STATUSES },
        },
      },
    })
  } else if (mergedCancelingPlan) {
    andClauses.push({
      subscriptions: {
        some: {
          plan_key: planFilter,
          cancel_at_period_end: true,
        },
      },
    })
  } else {
    if (billingFilter === "subscribed") {
      andClauses.push({
        subscriptions: {
          some: {
            status: { in: SUBSCRIBED_SUBSCRIPTION_STATUSES },
          },
        },
      })
    }
    if (billingFilter === "canceling") {
      andClauses.push({
        subscriptions: {
          some: {
            cancel_at_period_end: true,
          },
        },
      })
    }
    // Plan sans fusion billing : même notion de « abonnement pertinent » que `billing=subscribed`
    if (planFilter) {
      andClauses.push({
        subscriptions: {
          some: {
            plan_key: planFilter,
            status: { in: SUBSCRIBED_SUBSCRIPTION_STATUSES },
          },
        },
      })
    }
  }

  return andClauses.length > 0 ? { AND: andClauses } : {}
}
