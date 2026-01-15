// src/app/api/hub/coaches/route.ts
import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { getUserFromSession } from "@/lib/auth"
import { Prisma } from "@prisma/client"

export const runtime = "nodejs"

type PinCoach = {
  id: string
  slug: string
  name: string
  subtitle?: string | null
  country?: string | null
  language?: string | null
  lat: number
  lng: number
  isPremium: boolean
  coachQualificationScore?: number
}

function parseBBox(v: string | null) {
  if (!v) return null
  const parts = v.split(",").map((x) => Number(x))
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null
  const [west, south, east, north] = parts
  return { west, south, east, north }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

// Centroids “MVP” (tu pourras remplacer par lat/lng ville + géocodage plus tard)
const COUNTRY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  FR: { lat: 46.2276, lng: 2.2137 },
  BE: { lat: 50.5039, lng: 4.4699 },
  CH: { lat: 46.8182, lng: 8.2275 },
  CA: { lat: 56.1304, lng: -106.3468 },
  US: { lat: 39.8283, lng: -98.5795 },
  GB: { lat: 55.3781, lng: -3.4360 },
  ES: { lat: 40.4637, lng: -3.7492 },
  IT: { lat: 41.8719, lng: 12.5674 },
  DE: { lat: 51.1657, lng: 10.4515 },
  PT: { lat: 39.3999, lng: -8.2245 },
  NL: { lat: 52.1326, lng: 5.2913 },
}

function countryToCentroid(countryRaw: string | null | undefined) {
  const s = String(countryRaw || "").trim()
  if (!s) return null
  const up = s.toUpperCase()

  if (COUNTRY_CENTROIDS[up]) return COUNTRY_CENTROIDS[up]
  // Heuristiques (si country stocké “France”, “france”, etc.)
  if (up.includes("FRANCE")) return COUNTRY_CENTROIDS.FR
  if (up.includes("BELGI")) return COUNTRY_CENTROIDS.BE
  if (up.includes("SWITZ") || up.includes("SUISSE")) return COUNTRY_CENTROIDS.CH
  if (up.includes("UNITED STATES") || up === "USA") return COUNTRY_CENTROIDS.US
  if (up.includes("UNITED KINGDOM") || up.includes("UK")) return COUNTRY_CENTROIDS.GB

  return null
}

function isPremiumFromFeatures(features: string[]) {
  return features.includes("messages.unlimited") || features.some((f) => f.startsWith("coach."))
}

export async function GET(req: NextRequest) {
  const ctx = await getUserFromSession()
  if (!ctx) return new Response("Unauthorized", { status: 401 })

  const url = new URL(req.url)
  const bbox = parseBBox(url.searchParams.get("bbox"))

  // filtres
  const countryParam = (url.searchParams.get("country") || "").trim()
  const languageParam = (url.searchParams.get("language") || "").trim()

  // defaults = pays/langue user
  const me = await prisma.user.findUnique({
    where: { id: (ctx.user as any).id },
    select: { id: true, role: true, country: true, language: true },
  })
  if (!me) return new Response("Unauthorized", { status: 401 })

  const country = (countryParam || (me as any).country || "").trim()
  const language = (languageParam || "").trim()

  // ⚠️ bornage pour éviter “world dump”
  const take = clamp(parseInt(url.searchParams.get("limit") || "1200", 10), 1, 2000)

  // 1) Récupère les coachs candidats (Prisma-safe)
  const coaches = await prisma.coach.findMany({
    where: {
      user: {
        status: "active",
        role: "coach",
        onboardingStep: { gte: 3 },
        ...(country ? { country } : {}),
        ...(language ? { language } : {}),
      },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      subtitle: true,
      user: {
        select: {
          id: true,
          country: true,
          language: true,
          coachQualificationScore: true,
        },
      },
    },
    take,
  })

  if (coaches.length === 0) return Response.json({ pins: [] as PinCoach[] })

  const coachUserIds = coaches.map((c) => String((c.user as any).id)).filter(Boolean)

  // 2) Filtre entitlement hub.map.listing via la vue (source de vérité) :contentReference[oaicite:2]{index=2}
  let featuresByUserId = new Map<string, string[]>()
  try {
    const rows = await prisma.$queryRaw<{ user_id: string; features: string[] }[]>(
      Prisma.sql`
        SELECT user_id, features
        FROM user_effective_entitlements
        WHERE user_id IN (${Prisma.join(coachUserIds.map((id) => Prisma.sql`${id}::uuid`))})
      `,
    )
    for (const r of rows) featuresByUserId.set(String(r.user_id), Array.isArray(r.features) ? r.features : [])
  } catch {
    // Si la vue n’est pas dispo, on refuse de “dumper” la map (fail-closed)
    return new Response("Entitlements view unavailable", { status: 503 })
  }

  const pins: PinCoach[] = []
  for (const c of coaches) {
    const u = c.user as any
    const uid = String(u?.id || "")
    const features = featuresByUserId.get(uid) ?? []

    // ✅ visible sur Hub Map uniquement si hub.map.listing
    if (!features.includes("hub.map.listing")) continue

    const centroid = countryToCentroid(u?.country) || COUNTRY_CENTROIDS.FR
    const lat = centroid.lat
    const lng = centroid.lng

    // bbox
    if (bbox) {
      if (lng < bbox.west || lng > bbox.east || lat < bbox.south || lat > bbox.north) continue
    }

    pins.push({
      id: String(c.id),
      slug: String(c.slug),
      name: String(c.name || "Coach"),
      subtitle: c.subtitle ?? null,
      country: u?.country ?? null,
      language: u?.language ?? null,
      lat,
      lng,
      isPremium: isPremiumFromFeatures(features),
      coachQualificationScore:
        typeof u?.coachQualificationScore === "number" ? u.coachQualificationScore : undefined,
    })
  }

  return Response.json({ pins })
}
