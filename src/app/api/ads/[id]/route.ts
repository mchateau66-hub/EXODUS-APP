import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function getUserIdFromSession(sess: any): string | null {
  return (sess?.userId ?? sess?.id ?? sess?.user?.id ?? sess?.user?.userId) || null
}

function clampDays(v: any, def = 30) {
  const n = Number(v)
  if (!Number.isFinite(n)) return def
  return Math.max(1, Math.min(365, Math.floor(n)))
}

function cleanText(v: any, max = 240) {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return null
  return s.length > max ? s.slice(0, max).trim() : s
}

function cleanKeywords(raw: any): string[] {
  const arr = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : raw && typeof raw === 'object'
        ? Object.values(raw).flat()
        : []

  const uniq = new Set<string>()
  for (const x of arr) {
    const k = String(x ?? '').trim()
    if (!k) continue
    uniq.add(k.slice(0, 32))
    if (uniq.size >= 20) break
  }
  return Array.from(uniq)
}

function clampLatLng(lat: any, lng: any) {
  const la = Number(lat)
  const lo = Number(lng)
  const latOk = Number.isFinite(la) && la >= -90 && la <= 90
  const lngOk = Number.isFinite(lo) && lo >= -180 && lo <= 180
  return {
    lat: latOk ? la : null,
    lng: lngOk ? lo : null,
  }
}

function clampBudget(v: any) {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100000, Math.floor(n)))
}

/**
 * PATCH /api/ads/:id
 * Body:
 *  - { action: 'deactivate' }
 *  - { action: 'activate', durationDays?: number }
 *  - { action: 'update', title, goal?, sport?, keywords?, country?, city?, language?, budget_min?, budget_max?, lat?, lng? }
 *
 * Athlete only. Must own the ad.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sess: any = await getUserFromSession()
  const userId = getUserIdFromSession(sess)
  if (!userId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, onboardingStep: true },
  })
  if (!me) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  if (String(me.role) !== 'athlete') return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  if ((me.onboardingStep ?? 0) < 3) {
    return NextResponse.json({ ok: false, error: 'onboarding_required' }, { status: 409 })
  }

  const id = params?.id
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const action = String(body?.action ?? '').toLowerCase()

  // ownership check
  const owned = await prisma.athleteAd.findFirst({
    where: { id, athlete_id: userId },
    select: { id: true },
  })
  if (!owned) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  const now = new Date()

  // 1) deactivate
  if (action === 'deactivate') {
    const updated = await prisma.athleteAd.update({
      where: { id },
      data: {
        status: 'inactive',
        published_until: now, // rend “expirée” immédiatement
      },
      select: { id: true, status: true, published_until: true, updated_at: true },
    })
    return NextResponse.json({ ok: true, item: updated }, { headers: { 'cache-control': 'no-store' } })
  }

  // 2) activate (prolongation intelligente)
  if (action === 'activate') {
    const durationDays = clampDays(body?.durationDays, 30)

    const current = await prisma.athleteAd.findUnique({
      where: { id },
      select: { published_until: true },
    })

    const base =
      current?.published_until && current.published_until > now
        ? current.published_until
        : now

    const publishedUntil = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000)

    const updated = await prisma.athleteAd.update({
      where: { id },
      data: {
        status: 'active',
        published_until: publishedUntil,
      },
      select: { id: true, status: true, published_until: true, updated_at: true },
    })

    return NextResponse.json(
      { ok: true, item: updated, durationDays },
      { headers: { 'cache-control': 'no-store' } }
    )
  }

  // 3) update (édition)
  if (action === 'update') {
    const title = cleanText(body?.title, 80)
    if (!title) {
      return NextResponse.json({ ok: false, error: 'title_required' }, { status: 400 })
    }

    const goal = cleanText(body?.goal, 600)
    const sport = cleanText(body?.sport, 80)

    const countryRaw = cleanText(body?.country, 2)
    const country = countryRaw ? countryRaw.toUpperCase() : null

    const city = cleanText(body?.city, 80)

    const languageRaw = cleanText(body?.language, 12)
    const language = languageRaw ? languageRaw.toLowerCase() : null

    const keywords = cleanKeywords(body?.keywords)

    let budget_min = clampBudget(body?.budget_min)
    let budget_max = clampBudget(body?.budget_max)
    if (budget_min != null && budget_max != null && budget_min > budget_max) {
      // petit garde-fou
      ;[budget_min, budget_max] = [budget_max, budget_min]
    }

    const coords = clampLatLng(body?.lat, body?.lng)

    const updated = await prisma.athleteAd.update({
      where: { id },
      data: {
        title,
        goal,
        sport,
        keywords: keywords.length ? keywords : null,
        country: country && /^[A-Z]{2}$/.test(country) ? country : null,
        city,
        language,
        budget_min,
        budget_max,
        lat: coords.lat,
        lng: coords.lng,
      },
      select: {
        id: true,
        title: true,
        goal: true,
        sport: true,
        keywords: true,
        country: true,
        city: true,
        language: true,
        budget_min: true,
        budget_max: true,
        lat: true,
        lng: true,
        status: true,
        published_until: true,
        updated_at: true,
      },
    })

    return NextResponse.json({ ok: true, item: updated }, { headers: { 'cache-control': 'no-store' } })
  }

  return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
}
