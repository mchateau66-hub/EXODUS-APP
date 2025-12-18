// src/app/onboarding/step-2/page.tsx
import { redirect } from "next/navigation"
import { getUserFromSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import CoachOnboardingStep2Client from "../ui/CoachOnboardingStep2Client"
import AthleteStep2Form from "../AthleteStep2Form"

export const runtime = "nodejs"

function uniq(list: string[]) {
  return Array.from(new Set(list))
}

function splitCsv(v: unknown): string[] {
  if (typeof v !== "string") return []
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

const LOCATION_PREFS = [
  "Peu importe (full distanciel)",
  "Plutôt proche de chez moi",
  "Même pays uniquement",
] as const

function mapLocationPref(v: unknown): string {
  if (typeof v !== "string") return "Même pays uniquement"
  if ((LOCATION_PREFS as readonly string[]).includes(v)) return v

  const low = v.toLowerCase()
  if (low.includes("distanc")) return "Peu importe (full distanciel)"
  if (low.includes("proche")) return "Plutôt proche de chez moi"

  return "Même pays uniquement"
}

export default async function OnboardingStep2Page() {
  const session = await getUserFromSession()
  if (!session) {
    redirect("/login?next=/onboarding/step-2")
  }

  const userId = (session.user as any).id as string

  // ✅ Source de vérité: DB (évite session stale)
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingStep: true,
      role: true,
      onboardingStep2Answers: true,
    },
  })

  if (!dbUser) {
    redirect("/login?next=/onboarding/step-2")
  }

  const step =
    typeof dbUser.onboardingStep === "number" ? dbUser.onboardingStep : 0
  const role = dbUser.role as "athlete" | "coach" | "admin"
  const answers = (dbUser.onboardingStep2Answers ?? {}) as any

  // 🔒 Onboarding terminé → hub (routing central)
  if (step >= 3) {
    redirect("/hub")
  }

  // 🟡 Étape 1 pas encore faite → retour à /onboarding
  if (step < 1) {
    redirect("/onboarding")
  }

  // ✅ Étape 2 déjà complétée → étape 3
  if (step >= 2) {
    redirect("/onboarding/step-3")
  }

  // Si rôle inattendu → hub
  if (role !== "coach" && role !== "athlete") {
    redirect("/hub")
  }

  // ----------------------------
  // Prefill coach
  // ----------------------------
  const initialMainSports: string[] = Array.isArray(answers?.mainSports)
    ? answers.mainSports.map(String)
    : []

  const initialKeywords: string[] = Array.isArray(answers?.keywords)
    ? answers.keywords.map(String)
    : []

  const initialYearsExperience =
    typeof answers?.yearsExperience === "number"
      ? answers.yearsExperience
      : Number(answers?.yearsExperience ?? 0) || 0

  const initialHighestDiploma =
    typeof answers?.highestDiploma === "string"
      ? answers.highestDiploma
      : "none"

  const initialCertifications =
    typeof answers?.certifications === "string" ? answers.certifications : ""

  const initialHasClubExperience = answers?.hasClubExperience === true
  const initialRemoteCoaching = answers?.remoteCoaching === true
  const initialInPersonCoaching = answers?.inPersonCoaching === true

  // ----------------------------
  // Prefill athlète (support ancien format { answers: {...} })
  // ----------------------------
  const a =
    answers?.answers && typeof answers.answers === "object" ? answers.answers : answers

  const athleteInitialPriceRange =
    typeof a?.budgetRange === "string"
      ? a.budgetRange
      : typeof a?.priceRange === "string"
        ? a.priceRange
        : ""

  const athleteMainSport =
    typeof a?.mainSport === "string" ? a.mainSport.trim() : ""

  const athleteSecondarySports: string[] =
    Array.isArray(a?.secondarySports)
      ? a.secondarySports.map(String)
      : typeof a?.secondarySports === "string"
        ? splitCsv(a.secondarySports)
        : []

  const athleteInitialDisciplines = uniq(
    [athleteMainSport, ...athleteSecondarySports].filter(Boolean),
  ).slice(0, 5)

  const athleteInitialCoachPersonality: string[] =
    Array.isArray(a?.coachPersonality)
      ? a.coachPersonality.map(String)
      : typeof a?.coachPersonality === "string"
        ? splitCsv(a.coachPersonality)
        : []

  const athleteInitialFollowupDuration =
    typeof a?.preferredFollowupDuration === "string"
      ? a.preferredFollowupDuration
      : typeof a?.followupDuration === "string"
        ? a.followupDuration
        : ""

  const athleteInitialLocationPreference = mapLocationPref(
    typeof a?.location === "string" ? a.location : a?.locationPreference,
  )

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-3xl">
        {role === "coach" ? (
          <CoachOnboardingStep2Client
            initialMainSports={initialMainSports}
            initialKeywords={initialKeywords}
            initialYearsExperience={initialYearsExperience}
            initialHighestDiploma={initialHighestDiploma as any}
            initialCertifications={initialCertifications}
            initialHasClubExperience={initialHasClubExperience}
            initialRemoteCoaching={initialRemoteCoaching}
            initialInPersonCoaching={initialInPersonCoaching}
          />
        ) : (
          <AthleteStep2Form
            initialPriceRange={athleteInitialPriceRange}
            initialDisciplines={athleteInitialDisciplines}
            initialCoachPersonality={athleteInitialCoachPersonality}
            initialFollowupDuration={athleteInitialFollowupDuration}
            initialLocationPreference={athleteInitialLocationPreference}
          />
        )}
      </section>
    </main>
  )
}
