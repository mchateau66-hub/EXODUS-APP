import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

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

function safeUA() {
  // IMPORTANT: Nominatim demande un User-Agent identifiable.
  // Mets idéalement NOMINATIM_USER_AGENT dans .env (ex: "RencontreCoach/1.0 (contact@ton-domaine.com)")
  return process.env.NOMINATIM_USER_AGENT || 'EXODUS/1.0'
}

export async function GET(req: NextRequest) {
  const session = await getUserFromSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  const country = (url.searchParams.get('country') || '').trim().toLowerCase()
  const language = (url.searchParams.get('language') || '').trim()

  if (q.length < 3) {
    return NextResponse.json(
      { ok: true, items: [] },
      { headers: { 'cache-control': 'no-store' } }
    )
  }

  const sp = new URLSearchParams()
  sp.set('q', q)
  sp.set('format', 'jsonv2')
  sp.set('addressdetails', '1')
  sp.set('limit', '6')

  // Filtre pays (optionnel)
  if (/^[a-z]{2}$/.test(country)) sp.set('countrycodes', country)

  const nominatimUrl = `https://nominatim.openstreetmap.org/search?${sp.toString()}`

  const headers: Record<string, string> = {
    'User-Agent': safeUA(),
  }
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

    const data: any[] = await r.json()

    const items = (data || []).map((it) => {
      const lat = Number(it?.lat)
      const lng = Number(it?.lon)
      const addr = it?.address || {}
      const cityLabel = pickCityLabel(addr)
      const cc = String(addr?.country_code || '').toUpperCase()

      // Label lisible (ville + région + pays)
      const labelParts = [
        cityLabel || it?.name || '',
        addr?.state || addr?.region || '',
        cc || '',
      ].filter(Boolean)

      return {
        id: String(it?.place_id || `${lat},${lng}`),
        label: labelParts.join(', ') || String(it?.display_name || q),
        city: cityLabel || null,
        state: addr?.state || null,
        country_code: cc || null,
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
      }
    })

    // cache courte (évite spam)
    return NextResponse.json(
      { ok: true, items: items.filter((x) => x.lat !== null && x.lng !== null) },
      { headers: { 'cache-control': 'private, max-age=60' } }
    )    
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: 'fetch_failed', message: e?.message || 'fetch_failed' },
      { status: 502 }
    )
  }
}
