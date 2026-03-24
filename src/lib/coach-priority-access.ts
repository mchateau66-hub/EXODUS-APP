import { FEATURE_KEYS } from "@/domain/billing/features"
import { userHasFeature } from "@/server/features"

/**
 * Même règle que le Hub (`coach.priority_listing` actif sur `UserEntitlement`).
 */
export async function getCoachPriorityListingAvailability(
  userId: string,
  now: Date = new Date(),
): Promise<boolean> {
  try {
    return await userHasFeature(userId, FEATURE_KEYS.coachPriorityListing, now)
  } catch (e) {
    console.warn("coach_priority_listing_availability_failed", { userId, error: String(e) })
    return false
  }
}
