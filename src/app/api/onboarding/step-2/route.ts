// src/app/api/onboarding/step-2/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { COACH_KEYWORDS } from "@/data/coachKeywords"
import { SPORTS_TAXONOMY } from "@/data/sports"

export const runtime = "nodejs"

function normKey(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
}

function sanitizeText(v: unknown, max = 200) {
  if (typeof v !== "string") return ""
  return v
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
}

function toStringList(v: unknown, maxItems = 50, itemMaxLen = 60): string[] {
  if (!v) return []
  const raw: string[] = Array.isArray(v)
    ? v.map(String)
    : typeof v === "string"
      ? v.split(",").map((x) => x.trim())
      : []
  const out: string[] = []
  for (const it of raw) {
    const s = sanitizeText(it, itemMaxLen)
    if (!s) continue
    out.push(s)
    if (out.length >= maxItems) break
  }
  return out
}

function uniqCI(list: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of list) {
    const k = normKey(s)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(s)
  }
  return out
}

const SPORTS_CANON = (() => {
  const m = new Map<string, string>()
  for (const s of SPORTS_TAXONOMY) m.set(normKey(s), s)
  return m
})()

function canonicalizeSports(list: string[], max = 20) {
  const out: string[] = []
  for (const raw of list) {
    const s = sanitizeText(raw, 60)
    if (!s) continue
    const canon = SPORTS_CANON.get(normKey(s)) ?? s // garde custom si pas dans taxo
    out.push(canon)
    if (out.length >= max) break
  }
  return uniqCI(out).slice(0, max)
}

function canonicalizeKeywords(list: string[], max = 25) {
  const out: string[] = []
  for (const raw of list) {
    const s = sanitizeText(raw, 60)
    if (!s) continue
    const canon = COACH_KEYWORDS.find((k) => normKey(k) === normKey(s))
    if (!canon) continue // on drop les inconnus
    out.push(canon)
    if (out.length >= max) break
  }
  return uniqCI(out).slice(0, max)
}

function clampNumber(v: unknown, min: number, max: number, fallback: number) {
  const n = typeof v === "number" ? v : Number(v)
  if (Number.isNaN(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

function computeCoachQualificationScore(payload: any): number {
  if (!payload || typeof payload !== "object") return 0

  let score = 0

  const highestDiploma = (payload as any).highestDiploma as
    | "none"
    | "bpjeps"
    | "staps_licence"
    | "staps_master"
    | "federation"
    | "other"
    | undefined

  const yearsExperience = Number((payload as any).yearsExperience ?? 0)
  const hasClubExperience = (payload as any).hasClubExperience === true
  const certificationsText =
    typeof (payload as any).certifications === "string"
      ? (payload as any).certifications
      : ""

  switch (highestDiploma) {
    case "bpjeps":
      score += 25
      break
    case "staps_licence":
      score += 35
      break
    case "staps_master":
      score += 45
      break
    case "federation":
      score += 30
      break
    case "other":
      score += 15
      break
    case "none":
    default:
      break
  }

  if (!Number.isNaN(yearsExperience) && yearsExperience > 0) {
    score += Math.min(40, yearsExperience * 4)
  }

  if (hasClubExperience) score += 10
  if (certificationsText.trim().length > 0) score += 10

  if (score < 0) score = 0
  if (score > 100) score = 100
  return score
}

/**
 * GET /api/onboarding/step-2
 * Source de vérité DB (évite session stale)
 */
export async function GET(_req: NextRequest) {
  const session = await getUserFromSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const userId = (session.user as any).id as string

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingStep: true, role: true, onboardingStep2Answers: true },
  })

  if (!dbUser) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    step: typeof dbUser.onboardingStep === "number" ? dbUser.onboardingStep : 0,
    role: dbUser.role,
    answers: dbUser.onboardingStep2Answers ?? {},
  })
}

/**
 * POST /api/onboarding/step-2
 * Accepte 2 formats :
 * - payload direct (recommandé)
 * - { answers: payload } (compat legacy)
 */
export async function POST(req: NextRequest) {
  const session = await getUserFromSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const userId = (session.user as any).id as string

  const body = await req.json().catch(() => null as unknown)
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "Body doit être un objet JSON." },
      { status: 400 },
    )
  }

  const payload =
    (body as any).answers && typeof (body as any).answers === "object" && !Array.isArray((body as any).answers)
      ? (body as any).answers
      : body

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingStep: true, role: true },
  })

  if (!dbUser) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const currentStep = typeof dbUser.onboardingStep === "number" ? dbUser.onboardingStep : 0
  if (currentStep < 1) {
    return NextResponse.json(
      {
        ok: false,
        error: "step_order_invalid",
        message: "Tu dois d'abord compléter l’étape 1 avant l’étape 2.",
      },
      { status: 400 },
    )
  }

  const role = dbUser.role as "coach" | "athlete" | "admin"

  // ✅ Sanitize + canonicalise (coach)
  let finalAnswers: any = {}
  let coachQualificationScore: number | undefined = undefined

  if (role === "coach") {
    const mainSports = canonicalizeSports(toStringList((payload as any).mainSports, 50, 60), 20)
    const keywords = canonicalizeKeywords(toStringList((payload as any).keywords, 80, 60), 25)

    finalAnswers = {
      mainSports,
      keywords,
      yearsExperience: clampNumber((payload as any).yearsExperience, 0, 50, 0),
      highestDiploma: ["none", "bpjeps", "staps_licence", "staps_master", "federation", "other"].includes(
        String((payload as any).highestDiploma ?? "none"),
      )
        ? String((payload as any).highestDiploma ?? "none")
        : "none",
      certifications: sanitizeText((payload as any).certifications, 600),
      hasClubExperience: (payload as any).hasClubExperience === true,
      remoteCoaching: (payload as any).remoteCoaching === true,
      inPersonCoaching: (payload as any).inPersonCoaching === true,
    }

    coachQualificationScore = computeCoachQualificationScore(finalAnswers)
  } else {
    // ✅ Athlète : on stocke proprement ce que tu as déjà dans AthleteStep2Form
    finalAnswers = {
      priceRange: sanitizeText((payload as any).priceRange, 120),
      disciplines: uniqCI(toStringList((payload as any).disciplines, 20, 80)).slice(0, 20),
      coachPersonality: uniqCI(toStringList((payload as any).coachPersonality, 20, 80)).slice(0, 20),
      followupDuration: sanitizeText((payload as any).followupDuration, 120),
      locationPreference: sanitizeText((payload as any).locationPreference, 120),
    }
  }

  const nextStep = currentStep < 2 ? 2 : currentStep

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingStep2Answers: finalAnswers as any,
      onboardingStep: nextStep,
      ...(coachQualificationScore !== undefined ? { coachQualificationScore } : {}),
    },
    select: {
      id: true,
      role: true,
      onboardingStep: true,
      onboardingStep2Answers: true,
      coachQualificationScore: true,
    },
  })

  return NextResponse.json({
    ok: true,
    step: updated.onboardingStep,
    role: updated.role,
    answers: updated.onboardingStep2Answers,
    coachQualificationScore: updated.coachQualificationScore,
    next: "/onboarding/step-3",
  })
}
