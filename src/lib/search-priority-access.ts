import { FEATURE_KEYS } from "@/domain/billing/features"
import { userHasFeature } from "@/server/features"

/**
 * Aligné sur le Hub (`search.priority` actif sur `UserEntitlement`), même règle que `getCoachListingTiers`.
 */
export async function getSearchPriorityAvailability(
  userId: string,
  now: Date = new Date(),
): Promise<boolean> {
  try {
    return await userHasFeature(userId, FEATURE_KEYS.searchPriority, now)
  } catch (error) {
    console.error("search_priority_availability_failed", { userId, error })
    return false
  }
}
