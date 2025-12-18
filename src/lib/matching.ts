// src/lib/matching.ts
import { prisma } from '@/lib/db'

export type MatchingFilters = {
  q?: string
  sport?: string
  country?: string
  language?: string
  budget?: 'low' | 'medium' | 'high'
  personality?: 'bienveillant' | 'direct' | 'pedagogue' | 'exigeant'
}

type CoachMatch = {
  coach: any
  score: number
  isPremium: boolean
}

/**
 * Calcule un score de matching entre un athlète et un coach
 * en combinant :
 * - sport principal
 * - préférences remote / présentiel
 * - pays / langue
 * - personnalité de coach souhaitée vs persona du coach
 * - coachQualificationScore
 * - entitlements Premium (petit boost)
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
    typeof athletePrefs?.mainSport === 'string'
      ? athletePrefs.mainSport.toLowerCase()
      : ''
  const coachSports =
    typeof coachStep2?.mainSports === 'string'
      ? coachStep2.mainSports.toLowerCase()
      : ''

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
    typeof coachUser?.country === 'string' &&
    coachUser.country.toLowerCase() === filters.country.toLowerCase()
  ) {
    score += 10
  }

  if (
    filters.language &&
    typeof coachUser?.language === 'string' &&
    coachUser.language.toLowerCase().startsWith(filters.language.toLowerCase())
  ) {
    score += 5
  }

  // Personnalité souhaitée vs persona du coach (step 1)
  const desiredPersonality = athletePrefs?.coachPersonality as
    | 'bienveillant'
    | 'direct'
    | 'pedagogue'
    | 'exigeant'
    | undefined

  const coachPersona = coachStep1?.personaType as
    | 'coach_expert'
    | 'coach_pedagogue'
    | 'coach_motivateur'
    | 'coach_bienveillant'
    | string
    | undefined

  if (desiredPersonality && coachPersona) {
    if (
      (desiredPersonality === 'bienveillant' &&
        coachPersona === 'coach_bienveillant') ||
      (desiredPersonality === 'pedagogue' &&
        coachPersona === 'coach_pedagogue') ||
      (desiredPersonality === 'direct' && coachPersona === 'coach_expert') ||
      (desiredPersonality === 'exigeant' &&
        coachPersona === 'coach_motivateur')
    ) {
      score += 10
    }
  }

  // Qualification (0–100) → 0–20 pts
  const qual =
    typeof coachUser?.coachQualificationScore === 'number'
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

/**
 * Retourne une liste de coachs matchés pour un athlète donné,
 * triés par score décroissant.
 */
export async function getCoachMatchesForAthlete(
  athleteUserId: string,
  filters: MatchingFilters,
): Promise<CoachMatch[]> {
  const athlete = await prisma.user.findUnique({
    where: { id: athleteUserId },
  })

  if (!athlete) return []

  const athletePrefs = (athlete as any).onboardingStep2Answers ?? {}

  const coaches = await prisma.coach.findMany({
    where: {
      // On ne garde que les coachs qui ont un user actif
      user: {
        status: 'active',
        role: 'coach',
        ...(filters.country
          ? { country: filters.country }
          : {}),
        ...(filters.language
          ? { language: filters.language }
          : {}),
      },
    },
    include: {
      user: {
        include: {
          entitlements: true,
        },
      },
    },
  })

  const q = filters.q?.toLowerCase().trim() || null

  const matches: CoachMatch[] = coaches
    .map((coach) => {
      const coachUser = coach.user as any
      if (!coachUser) return null

      const coachStep1 = coachUser.onboardingStep1Answers ?? {}
      const coachStep2 = coachUser.onboardingStep2Answers ?? {}

      const isPremium =
        Array.isArray(coachUser.entitlements) &&
        coachUser.entitlements.some((e: any) =>
          typeof e.feature_key === 'string' &&
          (e.feature_key.startsWith('coach.') ||
            e.feature_key === 'messages.unlimited'),
        )

      // Filtre texte simple (nom, sous-titre, sports, bio)
      if (q) {
        const haystack = [
          coach.name,
          coach.subtitle,
          coachStep2?.mainSports,
          coachUser.bio,
          coachUser.country,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (!haystack.includes(q)) {
          // On ne supprime pas complètement, mais on peut
          // décider d'appliquer un gros malus. Ici, on filtre.
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
