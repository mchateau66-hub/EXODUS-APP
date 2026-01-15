// src/app/api/onboarding/step-3/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { COACH_KEYWORDS } from "@/data/coachKeywords"

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
  return v.replace(/\s+/g, " ").trim().slice(0, max)
}

function sanitizeBio(v: unknown, max = 1200) {
  if (typeof v !== "string") return ""
  return v.trim().slice(0, max)
}

function parseKeywords(raw: unknown, maxItems = 25, itemMaxLen = 60) {
  const list: string[] = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === "string"
      ? raw.split(",").map((x) => x.trim())
      : []

  const out: string[] = []
  const seen = new Set<string>()

  for (const it of list) {
    const s = sanitizeText(it, itemMaxLen)
    if (!s) continue
    const k = normKey(s)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(s)
    if (out.length >= maxItems) break
  }

  return out
}

function canonicalizeCoachKeywords(list: string[], max = 25) {
  const out: string[] = []
  const seen = new Set<string>()

  for (const raw of list) {
    const match = COACH_KEYWORDS.find((k) => normKey(k) === normKey(raw))
    if (!match) continue
    const kk = normKey(match)
    if (seen.has(kk)) continue
    seen.add(kk)
    out.push(match)
    if (out.length >= max) break
  }

  return out
}

function sanitizeUrl(v: unknown, max = 500) {
  const s = sanitizeText(v, max)
  if (!s) return ""
  try {
    const u = new URL(s)
    if (u.protocol !== "https:" && u.protocol !== "http:") return ""
    return u.toString().slice(0, max)
  } catch {
    return ""
  }
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000)
}

/**
 * Grant 30j "Hub Map listing" aux coachs quand ils finalisent réellement l'étape 3.
 * - Respecte la contrainte anti-overlap (EXCLUDE gist) : on UPDATE si déjà actif.
 * - Ne re-grant pas si l'utilisateur édite son profil après coup.
 */
async function grantCoachHubMapTrialIfNeeded(tx: typeof prisma, userId: string) {
  const now = new Date()
  const trialDays = 30
  const featureKey = "hub.map.listing"
  const trialEnd = addDays(now, trialDays)

  // Si déjà une entitlement active sur cette feature, on évite d'en créer une seconde (overlap).
  const existingActive = await tx.userEntitlement.findFirst({
    where: {
      user_id: userId,
      feature_key: featureKey,
      starts_at: { lte: now },
      OR: [{ expires_at: null }, { expires_at: { gt: now } }],
    },
    select: { id: true, source: true, expires_at: true },
  })

  if (existingActive) {
    // Si c'est une promo déjà en cours, on peut éventuellement prolonger jusqu'à trialEnd.
    if (existingActive.source === "promo") {
      const currentExp = existingActive.expires_at
      if (!currentExp || currentExp < trialEnd) {
        await tx.userEntitlement.update({
          where: { id: existingActive.id },
          data: {
            expires_at: trialEnd,
            meta: { reason: "coach_trial_30d_extended_on_step3" },
          },
        })
      }
    }
    return
  }

  // Sinon, on crée la promo 30j
  await tx.userEntitlement.create({
    data: {
      user_id: userId,
      feature_key: featureKey,
      source: "promo",
      starts_at: now,
      expires_at: trialEnd,
      meta: { reason: "coach_trial_30d_on_step3" },
    },
  })
}

/**
 * GET /api/onboarding/step-3
 * → Source de vérité DB (évite session stale)
 */
export async function GET(_req: NextRequest) {
  const session = await getUserFromSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const userId = (session.user as any).id as string

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingStep: true,
      role: true,
      name: true,
      age: true,
      country: true,
      language: true,
      avatarUrl: true,
      bio: true,
      keywords: true,
      theme: true,
    },
  })

  if (!dbUser) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const keywords =
    Array.isArray((dbUser as any).keywords) ? (dbUser as any).keywords.map(String) : []

  return NextResponse.json(
    {
      ok: true,
      step: typeof dbUser.onboardingStep === "number" ? dbUser.onboardingStep : 0,
      role: dbUser.role ?? null,
      profile: {
        name: dbUser.name ?? "",
        age: dbUser.age ?? null,
        country: dbUser.country ?? "",
        language: dbUser.language ?? "",
        avatarUrl: dbUser.avatarUrl ?? "",
        bio: dbUser.bio ?? "",
        keywords,
        theme: dbUser.theme ?? "light",
      },
    },
    { headers: { "cache-control": "no-store" } },
  )
}

/**
 * POST /api/onboarding/step-3
 * Body = JSON:
 * {
 *   name?: string
 *   age?: number | null
 *   country?: string
 *   language?: string
 *   avatarUrl?: string
 *   bio?: string
 *   keywords?: string[] | string
 *   theme?: "light" | "dark"
 * }
 *
 * → Met à jour le profil User + onboardingStep >= 3
 * → si role=coach et passage réel à step3 : grant hub.map.listing (promo 30j)
 * → next = /hub (destination unique)
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
      {
        ok: false,
        error: "invalid_body",
        message: "Le corps doit être un objet JSON avec les champs de profil.",
      },
      { status: 400 },
    )
  }

  // ✅ Source de vérité DB pour step/role
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingStep: true, role: true },
  })

  if (!dbUser) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const currentStep = typeof dbUser.onboardingStep === "number" ? dbUser.onboardingStep : 0

  // 🔒 On ne permet pas de sauter les étapes 1 & 2
  if (currentStep < 2) {
    return NextResponse.json(
      {
        ok: false,
        error: "step_order_invalid",
        message: "Tu dois d'abord compléter les étapes précédentes avant de finaliser ton profil.",
      },
      { status: 400 },
    )
  }

  const rawTheme =
    (body as any).theme === "dark" || (body as any).theme === "light"
      ? ((body as any).theme as "dark" | "light")
      : "light"

  let age: number | null = null
  const rawAge = (body as any).age
  if (typeof rawAge === "number" && Number.isFinite(rawAge)) {
    const a = Math.round(rawAge)
    age = a > 0 && a < 120 ? a : null
  } else if (rawAge === null) {
    age = null
  }

  // keywords
  const parsedKeywords = parseKeywords((body as any).keywords)
  const keywords =
    dbUser.role === "coach"
      ? canonicalizeCoachKeywords(parsedKeywords)
      : parsedKeywords

  const nextStep = currentStep < 3 ? 3 : currentStep
  const isCompletingStep3Now = currentStep < 3 && nextStep === 3
  const isCoach = String(dbUser.role ?? "").toLowerCase() === "coach"

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId },
      data: {
        name: sanitizeText((body as any).name, 80) || null,
        age,
        country: sanitizeText((body as any).country, 80) || null,
        language: sanitizeText((body as any).language, 20) || null,
        avatarUrl: sanitizeUrl((body as any).avatarUrl, 500) || null,
        bio: sanitizeBio((body as any).bio, 1200) || null,
        keywords,
        theme: rawTheme,
        onboardingStep: nextStep,
      },
      select: {
        id: true,
        role: true,
        onboardingStep: true,
        name: true,
        country: true,
        language: true,
        theme: true,
      },
    })

    // ✅ Grant promo Hub Map listing (30j) seulement au moment où le coach atteint l'étape 3
    if (isCoach && isCompletingStep3Now) {
      await grantCoachHubMapTrialIfNeeded(tx, userId)
    }

    return u
  })

  return NextResponse.json(
    {
      ok: true,
      step: updated.onboardingStep,
      role: updated.role,
      profile: {
        name: updated.name,
        country: updated.country,
        language: updated.language,
        theme: updated.theme,
      },
      next: "/hub",
    },
    { headers: { "cache-control": "no-store" } },
  )
}
