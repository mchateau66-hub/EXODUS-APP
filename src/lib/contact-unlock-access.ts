import { FEATURE_KEYS } from "@/domain/billing/features"
import { userHasFeature } from "@/server/features"

export type ContactUnlockAccessCheck = {
  allowed: boolean
  reason?: "feature_forbidden"
}

/**
 * Gate produit pour le déverrouillage de contact (DB entitlements).
 * Accepte `contact.unlock` ou `contacts.view` (historique plans / grants).
 */
export async function checkContactUnlockAccess(
  userId: string,
  now: Date = new Date(),
): Promise<ContactUnlockAccessCheck> {
  const [hasUnlock, hasLegacyView] = await Promise.all([
    userHasFeature(userId, FEATURE_KEYS.contactUnlock, now),
    userHasFeature(userId, FEATURE_KEYS.contactsView, now),
  ])
  if (hasUnlock || hasLegacyView) {
    return { allowed: true }
  }
  return { allowed: false, reason: "feature_forbidden" }
}

/** Lecture seule — aligné sur `checkContactUnlockAccess` (UI / settings). */
export async function getContactUnlockAvailability(userId: string, now: Date = new Date()): Promise<boolean> {
  const r = await checkContactUnlockAccess(userId, now)
  return r.allowed
}
