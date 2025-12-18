// src/server/features.ts
import { prisma } from '@/lib/db'
import {
  FEATURE_KEYS,
  type FeatureKey,
} from '@/domain/billing/features'

type UserId = string
type CoachId = string

export async function userHasFeature(
  userId: UserId,
  featureKey: FeatureKey,
  now: Date = new Date(),
): Promise<boolean> {
  const entitlement = await prisma.userEntitlement.findFirst({
    where: {
      user_id: userId,
      feature_key: featureKey,
      starts_at: { lte: now },
      OR: [
        { expires_at: null },
        { expires_at: { gt: now } },
      ],
    },
    select: { id: true },
  })

  return !!entitlement
}

/**
 * Athlète avec messagerie illimitée (Premium)
 */
export async function userHasUnlimitedMessages(
  userId: UserId,
  now: Date = new Date(),
): Promise<boolean> {
  return userHasFeature(
    userId,
    FEATURE_KEYS.messagesUnlimited,
    now,
  )
}

/**
 * Athlète autorisé à utiliser la messagerie :
 * - soit Premium (messages.unlimited),
 * - soit encore en période d’essai (messages.free_trial actif)
 */
export async function userHasMessagesAccess(
  userId: UserId,
  now: Date = new Date(),
): Promise<boolean> {
  const [unlimited, trial] = await Promise.all([
    userHasFeature(userId, FEATURE_KEYS.messagesUnlimited, now),
    userHasFeature(userId, FEATURE_KEYS.messagesFreeTrial, now),
  ])

  return unlimited || trial
}

/**
 * Coach avec nombre d’athlètes illimité (offre Premium coach)
 *
 * Ici on prend l'ID du COACH (Coach.id), pas l'ID du user.
 * On résout d'abord coach.user_id puis on vérifie la feature côté User.
 */
export async function coachHasUnlimitedAthletes(
  coachId: CoachId,
  now: Date = new Date(),
): Promise<boolean> {
  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    select: { user_id: true },
  })

  // Coach non relié à un user → pas premium
  if (!coach?.user_id) {
    return false
  }

  return userHasFeature(
    coach.user_id,
    FEATURE_KEYS.coachUnlimitedAthletes,
    now,
  )
}

/**
 * Coach autorisé à exposer un lien externe (WhatsApp, etc.)
 * via la feature coach.external_app_link.
 */
export async function coachHasExternalAppLink(
  coachId: CoachId,
  now: Date = new Date(),
): Promise<boolean> {
  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    select: { user_id: true },
  })

  if (!coach?.user_id) {
    return false
  }

  return userHasFeature(
    coach.user_id,
    FEATURE_KEYS.coachExternalAppLink,
    now,
  )
}
