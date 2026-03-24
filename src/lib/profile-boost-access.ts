import { FEATURE_KEYS } from "@/domain/billing/features"
import { userHasFeature } from "@/server/features"

/**
 * Aligné sur le Hub (`profile.boost` actif sur `UserEntitlement`).
 */
export async function getProfileBoostAvailability(userId: string, now: Date = new Date()): Promise<boolean> {
  try {
    return await userHasFeature(userId, FEATURE_KEYS.profileBoost, now)
  } catch (e) {
    console.warn("profile_boost_availability_failed", { userId, error: String(e) })
    return false
  }
}
