import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function parseBBox(bbox: string | null) {
  if (!bbox) return null
  const parts = bbox.split(',').map((s) => Number(s.trim()))
  if (parts.length !== 4) return null

  const [minLng, minLat, maxLng, maxLat] = parts
  if ([minLng, minLat, maxLng, maxLat].some((n) => Number.isNaN(n))) return null

  // Vérifs complètes
  if (minLng < -180 || minLng > 180) return null
  if (maxLng < -180 || maxLng > 180) return null
  if (minLat < -90 || minLat > 90) return null
  if (maxLat < -90 || maxLat > 90) return null

  if (minLng > maxLng || minLat > maxLat) return null

  return { minLng, minLat, maxLng, maxLat }
}

function cleanQ(q: string | null) {
  const v = (q ?? '').trim()
  if (!v) return null
  return v.slice(0, 80)
}

function getUserIdFromSession(sess: any): string | null {
  return (sess?.userId ?? sess?.id ?? sess?.user?.id ?? sess?.user?.userId) || null
}

/**
 * GET /api/hub/ads
 * Coach only.
 * Query: country, language, bbox=minLng,minLat,maxLng,maxLat, q
 * Returns: { ok: true, items: AthleteAd[] }
 */
export async function GET(req: NextRequest) {
  const sess: any = await getUserFromSession()
  const userId = getUserIdFromSession(sess)
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, onboardingStep: true, country: true, language: true },
  })
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  if (String(user.role) !== 'coach') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  if ((user.onboardingStep ?? 0) < 3) {
    return NextResponse.json({ ok: false, error: 'onboarding_required' }, { status: 409 })
  }

  const url = new URL(req.url)
  const country = (url.searchParams.get('country') || user.country || '').toUpperCase() || null
  const language = (url.searchParams.get('language') || user.language || '').toLowerCase() || null
  const bbox = parseBBox(url.searchParams.get('bbox'))
  const q = cleanQ(url.searchParams.get('q'))

  const now = new Date()

  // ✅ Aligné schema.prisma:
  // - status default = "active"
  // - published_until / created_at
  const where: any = {
    status: { in: ['active', 'published'] },
    OR: [{ published_until: null }, { published_until: { gt: now } }],
    AND: [
      { lat: { not: null } },
      { lng: { not: null } },
    ],
  }

  if (country && /^[A-Z]{2}$/.test(country)) where.country = country
  if (language && /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(language)) where.language = language

  if (bbox) {
    where.AND.push({ lat: { gte: bbox.minLat, lte: bbox.maxLat } })
    where.AND.push({ lng: { gte: bbox.minLng, lte: bbox.maxLng } })
  }

  if (q) {
    where.AND.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { goal: { contains: q, mode: 'insensitive' } },
        { sport: { contains: q, mode: 'insensitive' } },
      ],
    })
  }

  const items = await prisma.athleteAd.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: 200,
    select: {
      id: true,
      title: true,
      goal: true,
      sport: true,
      keywords: true,
      country: true,
      city: true,
      language: true,
      lat: true,
      lng: true,
      published_until: true,
      created_at: true,
      status: true,
    },
  })

  return NextResponse.json(
    { ok: true, items },
    { headers: { 'cache-control': 'private, no-store' } }
  )
}
