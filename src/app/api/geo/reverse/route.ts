import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function safeUA() {
  // Nominatim demande un User-Agent identifiable.
  return process.env.NOMINATIM_USER_AGENT || 'EXODUS/1.0'
}

function parseNum(v: string | null) {
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function pickCityLabel(addr: any) {
  return (
    addr?.city ||
    addr?.town ||
    addr?.village ||
    addr?.municipality ||
    addr?.county ||
    addr?.state ||
    ''
  )
}

export async function GET(req: NextRequest) {
  const session = await getUserFromSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const lat = parseNum(url.searchParams.get('lat'))
  const lng = parseNum(url.searchParams.get('lng'))
  const language = (url.searchParams.get('language') || '').trim()

  if (lat === null || lng === null) {
    return NextResponse.json({ ok: false, error: 'validation', message: 'lat/lng requis' }, { status: 400 })
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ ok: false, error: 'validation', message: 'lat/lng invalides' }, { status: 400 })
  }

  const sp = new URLSearchParams()
  sp.set('format', 'jsonv2')
  sp.set('lat', String(lat))
  sp.set('lon', String(lng))
  sp.set('addressdetails', '1')
  sp.set('zoom', '14')

  const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?${sp.toString()}`

  const headers: Record<string, string> = { 'User-Agent': safeUA() }
  if (language) headers['Accept-Language'] = language

  try {
    const r = await fetch(nominatimUrl, { headers })
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      return NextResponse.json(
        { ok: false, error: 'nominatim_error', message: t || `HTTP ${r.status}` },
        { status: 502 }
      )
    }

    const json: any = await r.json()
    const addr = json?.address || {}

    const city = pickCityLabel(addr) || null
    const cc = String(addr?.country_code || '').toUpperCase() || null

    // label lisible (ville + région + pays)
    const labelParts = [
      city || '',
      addr?.state || addr?.region || '',
      cc || '',
    ].filter(Boolean)

    return NextResponse.json(
      {
        ok: true,
        item: {
          city,
          country_code: cc,
          label: labelParts.join(', ') || (json?.display_name ?? ''),
        },
      },
      { headers: { 'cache-control': 'private, max-age=120' } } 
    )
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: 'fetch_failed', message: e?.message || 'fetch_failed' },
      { status: 502 }
    )
  }
}
