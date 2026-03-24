import { prisma } from "@/lib/db"
import { FEATURE_KEYS } from "@/domain/billing/features"

export type CoachListingTier = "priority" | "boost" | "standard"

const TIER_FEATURES = [FEATURE_KEYS.coachPriorityListing, FEATURE_KEYS.profileBoost] as const

/**
 * Lit en une requête les entitlements `coach.priority_listing` et `profile.boost` pour les coachs donnés.
 * Règle : priority > boost > standard (un coach avec les deux est `priority`).
 */
export async function getCoachListingTiers(
  coachUserIds: string[],
  now: Date = new Date(),
): Promise<Map<string, CoachListingTier>> {
  if (coachUserIds.length === 0) {
    return new Map()
  }
  try {
    const rows = await prisma.userEntitlement.findMany({
      where: {
        user_id: { in: coachUserIds },
        feature_key: { in: [...TIER_FEATURES] },
        starts_at: { lte: now },
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
      select: { user_id: true, feature_key: true },
    })

    const hasPriority = new Set<string>()
    const hasBoost = new Set<string>()
    for (const r of rows) {
      const uid = String(r.user_id)
      if (r.feature_key === FEATURE_KEYS.coachPriorityListing) hasPriority.add(uid)
      if (r.feature_key === FEATURE_KEYS.profileBoost) hasBoost.add(uid)
    }

    const map = new Map<string, CoachListingTier>()
    for (const id of coachUserIds) {
      if (hasPriority.has(id)) {
        map.set(id, "priority")
      } else if (hasBoost.has(id)) {
        map.set(id, "boost")
      } else {
        map.set(id, "standard")
      }
    }
    return map
  } catch (e) {
    console.warn("coach_listing_tiers_read_failed", { error: String(e) })
    return new Map()
  }
}

/**
 * Buckets stables : priority → boost → standard ; ordre relatif inchangé dans chaque groupe.
 * Si `coachListingTiers` est vide (erreur en amont), tout est traité comme `standard` (ordre inchangé).
 */
export function prioritizeCoachResultsByTier<T extends { userId: string }>(
  items: T[],
  coachListingTiers: Map<string, CoachListingTier>,
): T[] {
  const priority: T[] = []
  const boost: T[] = []
  const standard: T[] = []
  for (const item of items) {
    const tier = coachListingTiers.get(item.userId) ?? "standard"
    if (tier === "priority") {
      priority.push(item)
    } else if (tier === "boost") {
      boost.push(item)
    } else {
      standard.push(item)
    }
  }
  return [...priority, ...boost, ...standard]
}
