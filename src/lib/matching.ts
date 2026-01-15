// src/lib/matching.ts
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"

export type MatchingFilters = {
  q?: string
  sport?: string
  country?: string
  language?: string
  budget?: "low" | "medium" | "high"
  personality?: "bienveillant" | "direct" | "pedagogue" | "exigeant"
}

type CoachMatch = {
  coach: any
  score: number
  isPremium: boolean
}

/**
 * Calcule un score de matching entre un athlète et un coach
 */
function computeMatchScore(args: {
  athletePrefs: any
  coachStep1: any
  coachStep2: any
  coachUser: any
  filters: MatchingFilters
  isPremium: boolean
}): number {
  const { athletePrefs, coachStep1, coachStep2, coachUser, filters, isPremium } =
    args

  let score = 20 // base

  const athleteSport =
    typeof athletePrefs?.mainSport === "string"
      ? athletePrefs.mainSport.toLowerCase()
      : ""
  const coachSports =
    typeof coachStep2?.mainSports === "string"
      ? coachStep2.mainSports.toLowerCase()
      : ""

  if (athleteSport && coachSports.includes(athleteSport)) {
    score += 40
  }

  // Préférences remote / présentiel
  const prefersRemote = athletePrefs?.prefersRemote === true
  const prefersInPerson = athletePrefs?.prefersInPerson === true
  const remoteCoaching = coachStep2?.remoteCoaching === true
  const inPersonCoaching = coachStep2?.inPersonCoaching === true

  if (prefersRemote && remoteCoaching) score += 10
  if (prefersInPerson && inPersonCoaching) score += 10

  // Pays / langue (filtres explicites)
  if (
    filters.country &&
    typeof coachUser?.country === "string" &&
    coachUser.country.toLowerCase() === filters.country.toLowerCase()
  ) {
    score += 10
  }

  if (
    filters.language &&
    typeof coachUser?.language === "string" &&
    coachUser.language.toLowerCase().startsWith(filters.language.toLowerCase())
  ) {
    score += 5
  }

  // Personnalité souhaitée vs persona du coach (step 1)
  const desiredPersonality = athletePrefs?.coachPersonality as
    | "bienveillant"
    | "direct"
    | "pedagogue"
    | "exigeant"
    | undefined

  const coachPersona = coachStep1?.personaType as
    | "coach_expert"
    | "coach_pedagogue"
    | "coach_motivateur"
    | "coach_bienveillant"
    | string
    | undefined

  if (desiredPersonality && coachPersona) {
    if (
      (desiredPersonality === "bienveillant" &&
        coachPersona === "coach_bienveillant") ||
      (desiredPersonality === "pedagogue" &&
        coachPersona === "coach_pedagogue") ||
      (desiredPersonality === "direct" && coachPersona === "coach_expert") ||
      (desiredPersonality === "exigeant" &&
        coachPersona === "coach_motivateur")
    ) {
      score += 10
    }
  }

  // Qualification (0–100) → 0–20 pts
  const qual =
    typeof coachUser?.coachQualificationScore === "number"
      ? coachUser.coachQualificationScore
      : 0
  score += Math.min(20, Math.max(0, qual / 5))

  // Petit boost Premium
  if (isPremium) {
    score += 5
  }

  // Filtre sport explicite : si demandé mais non matché → malus
  if (filters.sport) {
    const s = filters.sport.toLowerCase()
    if (!coachSports.includes(s)) {
      score -= 20
    }
  }

  // Clamp 0–100
  if (score < 0) score = 0
  if (score > 100) score = 100

  return score
}

function isPremiumFromFeatures(features: string[]) {
  // À ajuster selon ton catalogue exact.
  // Ici: premium si messages illimités OU features coach.* (bundle coach).
  return (
    features.includes("messages.unlimited") ||
    features.some((f) => f.startsWith("coach."))
  )
}

/**
 * Retourne une liste de coachs matchés pour un athlète donné,
 * triés par score décroissant.
 *
 * ✅ Ajout : filtre "Hub visible" via feature hub.map.listing (si vue entitlements dispo)
 * ✅ Ajout : features récupérées en batch depuis user_effective_entitlements (performant)
 */
export async function getCoachMatchesForAthlete(
  athleteUserId: string,
  filters: MatchingFilters,
): Promise<CoachMatch[]> {
  const athlete = await prisma.user.findUnique({
    where: { id: athleteUserId },
    select: {
      id: true,
      onboardingStep2Answers: true,
      country: true,
      language: true,
    },
  })

  if (!athlete) return []

  const athletePrefs = (athlete as any).onboardingStep2Answers ?? {}

  // Coaches candidats (filtrage DB basique)
  const coaches = await prisma.coach.findMany({
    where: {
      user: {
        status: "active",
        role: "coach",
        ...(filters.country ? { country: filters.country } : {}),
        ...(filters.language ? { language: filters.language } : {}),
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      subtitle: true,
      avatarInitial: true,
      user: {
        select: {
          id: true,
          bio: true,
          country: true,
          language: true,
          coachQualificationScore: true,
          onboardingStep1Answers: true,
          onboardingStep2Answers: true,
        },
      },
    },
  })

  if (coaches.length === 0) return []

  // --- Récupération features effectives (batch) ---
  const coachUserIds = coaches
    .map((c) => String((c.user as any)?.id ?? ""))
    .filter(Boolean)

  let featuresByUserId = new Map<string, string[]>()
  let entitlementsViewAvailable = true

  try {
    const rows = await prisma.$queryRaw<{ user_id: string; features: string[] }[]>(
      Prisma.sql`
        SELECT user_id, features
        FROM user_effective_entitlements
        WHERE user_id IN (${Prisma.join(coachUserIds.map((id) => Prisma.sql`${id}::uuid`))})
      `,
    )

    for (const r of rows) {
      featuresByUserId.set(String(r.user_id), Array.isArray(r.features) ? r.features : [])
    }
  } catch {
    // fallback fail-open (utile en dev si la vue n’est pas déployée)
    entitlementsViewAvailable = false
    featuresByUserId = new Map()
  }

  const q = filters.q?.toLowerCase().trim() || null

  const matches: CoachMatch[] = coaches
    .map((coach) => {
      const coachUser = coach.user as any
      if (!coachUser) return null

      const coachUserId = String(coachUser.id ?? "")
      const features = featuresByUserId.get(coachUserId) ?? []

      // ✅ Hub visibility gating: coach doit avoir hub.map.listing (si la vue est dispo)
      if (entitlementsViewAvailable) {
        if (!features.includes("hub.map.listing")) return null
      }

      const coachStep1 = coachUser.onboardingStep1Answers ?? {}
      const coachStep2 = coachUser.onboardingStep2Answers ?? {}

      const isPremium = entitlementsViewAvailable ? isPremiumFromFeatures(features) : false

      // Filtre texte simple (nom, sous-titre, sports, bio, pays)
      if (q) {
        const haystack = [
          coach.name,
          coach.subtitle,
          coachStep2?.mainSports,
          coachUser.bio,
          coachUser.country,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()

        if (!haystack.includes(q)) {
          return null
        }
      }

      const score = computeMatchScore({
        athletePrefs,
        coachStep1,
        coachStep2,
        coachUser,
        filters,
        isPremium,
      })

      return {
        coach,
        score,
        isPremium,
      }
    })
    .filter((m): m is CoachMatch => m !== null)
    .sort((a, b) => b.score - a.score)

  return matches
}
