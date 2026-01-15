import { NextRequest, NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

function sanitizeText(v: unknown, max = 120) {
  if (typeof v !== "string") return ""
  return v.replace(/\s+/g, " ").trim().slice(0, max)
}

function normKey(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
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

function parseNumber(v: unknown) {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

function clampLatLng(lat: number | null, lng: number | null) {
  const out = { lat: null as number | null, lng: null as number | null }
  if (lat !== null && lat >= -90 && lat <= 90) out.lat = lat
  if (lng !== null && lng >= -180 && lng <= 180) out.lng = lng
  return out
}

/**
 * GET /api/ads
 * -> retourne les annonces de l'utilisateur connecté (athlète)
 */
export async function GET(_req: NextRequest) {
  const session = await getUserFromSession()
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })

  const userId = (session.user as any).id as string

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  })
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })

  // Coach: pas ses annonces (pour l'instant)
  if (String(user.role) !== "athlete") {
    return NextResponse.json({ ok: true, items: [] }, { headers: { "cache-control": "no-store" } })
  }

  const items = await prisma.athleteAd.findMany({
    where: { athlete_id: userId },
    orderBy: { created_at: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      published_until: true,
      country: true,
      language: true,
      created_at: true,
      keywords: true,
    },
  })

  return NextResponse.json({ ok: true, items }, { headers: { "cache-control": "no-store" } })
}

/**
 * POST /api/ads
 * body:
 * {
 *   title: string
 *   goal?: string
 *   sport?: string
 *   keywords?: string[] | string
 *   country?: string
 *   city?: string
 *   language?: string
 *   budget_min?: number
 *   budget_max?: number
 *   lat?: number
 *   lng?: number
 *   durationDays?: number (optionnel, défaut 14)
 * }
 */
export async function POST(req: NextRequest) {
  const session = await getUserFromSession()
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })

  const userId = (session.user as any).id as string

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, country: true, language: true },
  })
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })

  if (String(user.role) !== "athlete") {
    return NextResponse.json({ ok: false, error: "forbidden", message: "Seuls les athlètes peuvent publier une annonce." }, { status: 403 })
  }

  const body = await req.json().catch(() => null as any)
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  const title = sanitizeText(body.title, 120)
  if (!title) {
    return NextResponse.json({ ok: false, error: "validation", message: "Titre requis." }, { status: 400 })
  }

  const goal = sanitizeText(body.goal, 800)
  const sport = sanitizeText(body.sport, 80)
  const keywords = parseKeywords(body.keywords)

  const country = sanitizeText(body.country, 80) || (user.country ?? null)
  const city = sanitizeText(body.city, 80) || null
  const language = sanitizeText(body.language, 20) || (user.language ?? null)

  const bmin = parseNumber(body.budget_min)
  const bmax = parseNumber(body.budget_max)
  const budget_min = bmin !== null ? Math.max(0, Math.round(bmin)) : null
  const budget_max = bmax !== null ? Math.max(0, Math.round(bmax)) : null
  if (budget_min !== null && budget_max !== null && budget_min > budget_max) {
    return NextResponse.json({ ok: false, error: "validation", message: "budget_min doit être <= budget_max." }, { status: 400 })
  }

  const lat = parseNumber(body.lat)
  const lng = parseNumber(body.lng)
  const ll = clampLatLng(lat, lng)

  const durationDaysRaw = parseNumber(body.durationDays)
  const durationDays = durationDaysRaw ? Math.max(1, Math.min(60, Math.round(durationDaysRaw))) : 14
  const published_until = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)

  const created = await prisma.athleteAd.create({
    data: {
      athlete_id: userId,
      title,
      goal: goal || "",
      sport: sport || "",
      keywords, // jsonb array côté DB
      country,
      city,
      language,
      budget_min,
      budget_max,
      lat: ll.lat,
      lng: ll.lng,
      status: "active",
      published_until,
    },
    select: {
      id: true,
      title: true,
      sport: true,
      goal: true,
      keywords: true,
      country: true,
      city: true,
      language: true,
      lat: true,
      lng: true,
      status: true,
      published_until: true,
      created_at: true,
      updated_at: true,
    },    
  })

  return NextResponse.json({ ok: true, item: created }, { headers: { "cache-control": "no-store" } })
}
