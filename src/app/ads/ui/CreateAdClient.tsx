'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

type Defaults = { country: string; language: string }
type Mode = 'create' | 'edit'

type AdInitial = {
  id?: string
  title?: string | null
  goal?: string | null
  sport?: string | null
  keywords?: any
  country?: string | null
  city?: string | null
  language?: string | null
  budget_min?: number | null
  budget_max?: number | null
  lat?: number | null
  lng?: number | null
}

type PlaceItem = {
  id: string
  label: string
  city: string | null
  state: string | null
  country_code: string | null
  lat: number
  lng: number
}

// ✅ réglages anti-spam reverse
const REVERSE_MIN_METERS = 100
const REVERSE_COOLDOWN_MS = 1200
const REVERSE_ZOOM_MIN = 11

// ✅ debug
const DEBUG_MAX_LINES = 30

type ReverseBadgeKind = 'idle' | 'skip' | 'inflight' | 'ok' | 'fail' | 'abort'
type ReverseBadge = { kind: ReverseBadgeKind; text: string; sub?: string; at: number }

// ✅ LeafletPicker chargé uniquement côté navigateur
const LeafletPicker = dynamic(() => import('./LeafletPicker'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] w-full items-center justify-center text-sm text-slate-600">
      Chargement de la carte…
    </div>
  ),
})

function splitKeywords(input: string) {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function keywordsToRaw(raw: any): string {
  if (!raw) return ''
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean).join(', ')
  if (typeof raw === 'object') {
    const flat = Object.values(raw).flat().map(String).filter(Boolean)
    return flat.join(', ')
  }
  return String(raw ?? '')
}

function toNumber(v: string): number | null {
  const s = (v ?? '').trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function normCountry(v: string) {
  return String(v ?? '').trim().toUpperCase()
}

function normLanguage(v: string) {
  return String(v ?? '').trim().toLowerCase()
}

/** Haversine distance (mètres) */
function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const sin1 = Math.sin(dLat / 2)
  const sin2 = Math.sin(dLng / 2)
  const h = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function Badge({
  kind = 'neutral',
  children,
  title,
}: {
  kind?: 'neutral' | 'good' | 'warn' | 'bad' | 'info'
  children: ReactNode
  title?: string
}) {
  const cls =
    kind === 'good'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : kind === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : kind === 'bad'
      ? 'border-red-200 bg-red-50 text-red-800'
      : kind === 'info'
      ? 'border-sky-200 bg-sky-50 text-sky-900'
      : 'border-slate-200 bg-slate-50 text-slate-700'

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {children}
    </span>
  )
}

function kindToBadgeStyle(kind: ReverseBadgeKind): 'neutral' | 'good' | 'warn' | 'bad' | 'info' {
  if (kind === 'ok') return 'good'
  if (kind === 'inflight') return 'info'
  if (kind === 'skip') return 'warn'
  if (kind === 'fail') return 'bad'
  return 'neutral'
}

export default function CreateAdClient({
  defaults,
  mode = 'create',
  adId,
  initial,
}: {
  defaults: Defaults
  mode?: Mode
  adId?: string
  initial?: AdInitial
}) {
  const router = useRouter()
  const isEdit = mode === 'edit' && !!adId

  const [title, setTitle] = useState(() => String(initial?.title ?? ''))
  const [goal, setGoal] = useState(() => String(initial?.goal ?? ''))
  const [sport, setSport] = useState(() => String(initial?.sport ?? ''))
  const [keywordsRaw, setKeywordsRaw] = useState(() => keywordsToRaw(initial?.keywords))

  const [country, setCountry] = useState(() => normCountry(String(initial?.country ?? defaults.country)))
  const [language, setLanguage] = useState(() => normLanguage(String(initial?.language ?? defaults.language)))

  // Ville + autocomplete
  const [city, setCity] = useState(() => String(initial?.city ?? ''))
  const [cityTouched, setCityTouched] = useState(() => Boolean(initial?.city)) // edit: verrouillée si déjà remplie

  const [places, setPlaces] = useState<PlaceItem[]>([])
  const [placeLoading, setPlaceLoading] = useState(false)
  const [placeErr, setPlaceErr] = useState<string | null>(null)
  const [showPlaces, setShowPlaces] = useState(false)
  const placeAbortRef = useRef<AbortController | null>(null)
  const placeDebounceRef = useRef<number | null>(null)

  // Localisation
  const [latStr, setLatStr] = useState(() => (typeof initial?.lat === 'number' ? initial.lat.toFixed(6) : ''))
  const [lngStr, setLngStr] = useState(() => (typeof initial?.lng === 'number' ? initial.lng.toFixed(6) : ''))
  const [geoLoading, setGeoLoading] = useState(false)

  // Reverse geocode
  const reverseAbortRef = useRef<AbortController | null>(null)
  const reverseInFlightRef = useRef(false)
  const lastReverseAttemptRef = useRef<{ lat: number; lng: number; at: number } | null>(null)
  const [reverseLoading, setReverseLoading] = useState(false)

  const [reverseBadge, setReverseBadge] = useState<ReverseBadge>(() => ({
    kind: 'idle',
    text: 'Reverse: idle',
    at: Date.now(),
  }))

  // Map picker + zoom badge
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [mapZoom, setMapZoom] = useState<number | null>(null)
  const [recenterNonce, setRecenterNonce] = useState(0)

  useEffect(() => {
    if (!showMapPicker) setMapZoom(null)
  }, [showMapPicker])

  // Budget (optionnel)
  const [budgetMinStr, setBudgetMinStr] = useState(() => (initial?.budget_min != null ? String(initial.budget_min) : ''))
  const [budgetMaxStr, setBudgetMaxStr] = useState(() => (initial?.budget_max != null ? String(initial.budget_max) : ''))

  // Backend clamp 60 dans /api/ads (create uniquement)
  const [durationDays, setDurationDays] = useState(14)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ✅ debug
  const [debug, setDebug] = useState(false)
  const [debugLines, setDebugLines] = useState<string[]>([])

  function dbg(line: string) {
    if (!debug) return
    const ts = new Date().toISOString().slice(11, 19)
    const full = `[${ts}] ${line}`
    setDebugLines((prev) => [...prev, full].slice(-DEBUG_MAX_LINES))
    // eslint-disable-next-line no-console
    console.debug(full)
  }

  // auto-enable debug via URL
  useEffect(() => {
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('geoDebug') === '1') setDebug(true)
  }, [])

  const keywordsPreview = useMemo(() => splitKeywords(keywordsRaw).slice(0, 25), [keywordsRaw])

  const latNum = toNumber(latStr)
  const lngNum = toNumber(lngStr)
  const hasCoords = latNum !== null && lngNum !== null

  const mapCenter = useMemo<[number, number]>(() => {
    if (hasCoords) return [latNum as number, lngNum as number]
    return [48.8566, 2.3522]
  }, [hasCoords, latNum, lngNum])

  const mapZoomWanted = hasCoords ? 12 : 6

  function requestRecenter() {
    setRecenterNonce((n) => n + 1)
  }

  /**
   * reverse uniquement si >100m depuis la dernière tentative
   * + cooldown
   * + si carte ouverte => zoom >= REVERSE_ZOOM_MIN
   * + si cityTouched => jamais
   */
  function getReverseDecision(lat: number, lng: number) {
    const reasons: string[] = []
    if (cityTouched) reasons.push('ville verrouillée')

    const zoom = showMapPicker ? mapZoom : null
    if (zoom !== null && zoom < REVERSE_ZOOM_MIN) reasons.push(`zoom ${zoom} < ${REVERSE_ZOOM_MIN}`)

    const now = Date.now()
    const last = lastReverseAttemptRef.current

    if (last) {
      const dist = metersBetween({ lat: last.lat, lng: last.lng }, { lat, lng })
      const since = now - last.at
      if (dist < REVERSE_MIN_METERS) reasons.push(`distance ${Math.round(dist)}m < ${REVERSE_MIN_METERS}m`)
      if (since < REVERSE_COOLDOWN_MS) reasons.push(`cooldown ${since}ms < ${REVERSE_COOLDOWN_MS}ms`)
    }

    return { ok: reasons.length === 0, reasons }
  }

  async function reverseGeocode(lat: number, lng: number) {
    const decision = getReverseDecision(lat, lng)

    if (!decision.ok) {
      const why = decision.reasons[0] || 'skip'
      setReverseBadge({ kind: 'skip', text: 'Reverse: SKIP', sub: why, at: Date.now() })
      dbg(`reverse SKIP lat=${lat.toFixed(5)} lng=${lng.toFixed(5)} :: ${decision.reasons.join(' | ')}`)
      return
    }

    if (reverseInFlightRef.current) {
      setReverseBadge({ kind: 'skip', text: 'Reverse: SKIP', sub: 'inFlight', at: Date.now() })
      dbg('reverse SKIP: inFlight=true')
      return
    }

    lastReverseAttemptRef.current = { lat, lng, at: Date.now() }

    reverseAbortRef.current?.abort()
    reverseAbortRef.current = new AbortController()

    reverseInFlightRef.current = true
    setReverseLoading(true)
    setReverseBadge({
      kind: 'inflight',
      text: 'Reverse: START',
      sub: `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
      at: Date.now(),
    })
    dbg(`reverse START lat=${lat.toFixed(5)} lng=${lng.toFixed(5)}`)

    try {
      const sp = new URLSearchParams()
      sp.set('lat', String(lat))
      sp.set('lng', String(lng))
      if (language) sp.set('language', language)

      const r = await fetch(`/api/geo/reverse?${sp.toString()}`, {
        signal: reverseAbortRef.current.signal,
        headers: { 'cache-control': 'no-store' },
      })

      const json = await r.json().catch(() => null)
      if (!r.ok || json?.ok === false) {
        setReverseBadge({ kind: 'fail', text: 'Reverse: FAIL', sub: `HTTP ${r.status}`, at: Date.now() })
        dbg(`reverse FAIL http=${r.status} err=${json?.error || 'unknown'}`)
        return
      }

      const c = String(json?.item?.city || '').trim()
      if (c && !cityTouched) {
        setCity(c)
        setReverseBadge({ kind: 'ok', text: 'Reverse: OK', sub: c, at: Date.now() })
        dbg(`reverse OK city="${c}"`)
      } else {
        setReverseBadge({ kind: 'ok', text: 'Reverse: OK', sub: 'no city', at: Date.now() })
        dbg('reverse OK (no city)')
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setReverseBadge({ kind: 'abort', text: 'Reverse: ABORT', sub: 'abort', at: Date.now() })
        dbg('reverse ABORT')
        return
      }
      setReverseBadge({ kind: 'fail', text: 'Reverse: ERROR', sub: e?.message || 'unknown', at: Date.now() })
      dbg(`reverse ERROR ${e?.message || 'unknown'}`)
    } finally {
      reverseInFlightRef.current = false
      setReverseLoading(false)
    }
  }

  function setCoords(lat: number, lng: number, opts?: { recenter?: boolean; reverse?: boolean; reason?: string }) {
    setLatStr(lat.toFixed(6))
    setLngStr(lng.toFixed(6))
    dbg(`setCoords lat=${lat.toFixed(5)} lng=${lng.toFixed(5)} reason=${opts?.reason || 'n/a'}`)

    if (opts?.recenter) requestRecenter()
    if (opts?.reverse !== false) reverseGeocode(lat, lng)
  }

  function clearCoords() {
    setLatStr('')
    setLngStr('')
    setReverseBadge({ kind: 'idle', text: 'Reverse: idle', at: Date.now() })
    dbg('clearCoords')
  }

  async function useMyLocation() {
    setError(null)

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setError("La géolocalisation n’est pas supportée sur ce navigateur.")
      return
    }

    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setCityTouched(false)
        setCoords(lat, lng, { recenter: true, reverse: true, reason: 'geoloc' })
        setGeoLoading(false)
      },
      (err) => {
        setGeoLoading(false)
        if (err.code === err.PERMISSION_DENIED) {
          setError("Permission refusée : autorise la localisation pour placer l’annonce sur la map.")
        } else {
          setError("Impossible de récupérer la localisation. Essaie la carte ou l’autocomplete ville.")
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    )
  }

  // Autocomplete ville (debounce + abort)
  useEffect(() => {
    const q = city.trim()
    setPlaceErr(null)

    if (placeDebounceRef.current) window.clearTimeout(placeDebounceRef.current)

    if (q.length < 3) {
      setPlaces([])
      return
    }

    placeDebounceRef.current = window.setTimeout(async () => {
      setPlaceLoading(true)
      placeAbortRef.current?.abort()
      placeAbortRef.current = new AbortController()

      try {
        const sp = new URLSearchParams()
        sp.set('q', q)
        if (country) sp.set('country', country)
        if (language) sp.set('language', language)

        const r = await fetch(`/api/geo/search?${sp.toString()}`, {
          signal: placeAbortRef.current.signal,
          headers: { 'cache-control': 'no-store' },
        })

        const json = await r.json().catch(() => null)
        if (!r.ok || json?.ok === false) {
          throw new Error(json?.message || json?.error || 'Erreur autocomplete')
        }

        const items: PlaceItem[] = Array.isArray(json?.items) ? json.items : []
        setPlaces(items)
        setShowPlaces(true)
      } catch (e: any) {
        if (e?.name === 'AbortError') return
        setPlaceErr(e?.message || 'Erreur autocomplete')
        setPlaces([])
      } finally {
        setPlaceLoading(false)
      }
    }, 350)

    return () => {
      if (placeDebounceRef.current) window.clearTimeout(placeDebounceRef.current)
      placeAbortRef.current?.abort()
    }
  }, [city, country, language])

  function selectPlace(p: PlaceItem) {
    setCityTouched(false)
    setCity(p.city || p.label)
    setCoords(p.lat, p.lng, { recenter: true, reverse: false, reason: 'autocomplete_select' })
    setShowPlaces(false)
    if (p.country_code && (!country || country.length !== 2)) {
      setCountry(p.country_code.toUpperCase())
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const lat = toNumber(latStr)
      const lng = toNumber(lngStr)

      const bmin = toNumber(budgetMinStr)
      const bmax = toNumber(budgetMaxStr)
      if (bmin !== null && bmax !== null && bmin > bmax) throw new Error('budget_min doit être <= budget_max.')

      const d = Math.max(1, Math.min(60, Math.round(durationDays || 14)))

      const payload = {
        title,
        goal,
        sport,
        keywords: keywordsPreview,
        country: normCountry(country),
        city,
        language: normLanguage(language),
        budget_min: bmin !== null ? Math.max(0, Math.round(bmin)) : null,
        budget_max: bmax !== null ? Math.max(0, Math.round(bmax)) : null,
        lat,
        lng,
        durationDays: d, // create only
      }

      const url = isEdit ? `/api/ads/${adId}` : '/api/ads'
      const method = isEdit ? 'PATCH' : 'POST'
      const body = isEdit ? { action: 'update', ...payload } : payload

      const r = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await r.json().catch(() => null)
      if (!r.ok || json?.ok === false) {
        const msg = json?.message || json?.error || 'Impossible de sauvegarder l’annonce'
        throw new Error(msg)
      }

      router.push('/hub')
      router.refresh()
    } catch (err: any) {
      setError(err?.message ?? 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const cityBadgeKind = cityTouched ? 'warn' : 'good'
  const coordsBadgeKind = hasCoords ? 'good' : 'warn'
  const reverseStyle = kindToBadgeStyle(reverseBadge.kind)

  const zoomBadgeKind =
    showMapPicker && mapZoom !== null ? (mapZoom >= REVERSE_ZOOM_MIN ? 'good' : 'warn') : 'neutral'

  const zoomBadgeTitle = showMapPicker
    ? mapZoom === null
      ? 'Zoom inconnu'
      : mapZoom >= REVERSE_ZOOM_MIN
      ? `Zoom OK (>= ${REVERSE_ZOOM_MIN})`
      : `Zoom trop bas pour reverse (< ${REVERSE_ZOOM_MIN})`
    : 'Ouvre la carte pour voir le zoom'

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4">
        <div>
          <label className="text-sm font-medium">Titre</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium">Objectif (détails)</label>
          <textarea
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={4}
            maxLength={800}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Sport</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              maxLength={80}
            />
          </div>

          {mode === 'create' ? (
            <div>
              <label className="text-sm font-medium">Durée (jours)</label>
              <input
                type="number"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value || '14', 10))}
                min={1}
                max={60}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              ℹ️ La durée se gère via “Relancer 7/30/90j” dans le Hub.
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Keywords (séparés par des virgules)</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={keywordsRaw}
            onChange={(e) => setKeywordsRaw(e.target.value)}
          />
          {keywordsPreview.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {keywordsPreview.map((k, i) => (
                <span key={`${k}-${i}`} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Pays</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              maxLength={2}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Langue</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              maxLength={12}
            />
          </div>
        </div>

        {/* Ville + autocomplete */}
        <div className="relative">
          <label className="text-sm font-medium">Ville (autocomplete + reverse)</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={city}
            onChange={(e) => {
              setCity(e.target.value)
              setCityTouched(true)
            }}
            onFocus={() => setShowPlaces(true)}
            onBlur={() => window.setTimeout(() => setShowPlaces(false), 150)}
            maxLength={80}
          />

          <div className="mt-2 flex flex-wrap gap-2">
            <Badge kind={cityBadgeKind} title="Si verrouillée, le reverse n'écrase pas la ville">
              {cityTouched ? 'Ville: verrouillée' : 'Ville: auto'}
            </Badge>

            <Badge kind={coordsBadgeKind} title="Lat/Lng nécessaires pour apparaître sur la map coach">
              {hasCoords ? 'Coords: OK' : 'Coords: manquantes'}
            </Badge>

            <Badge kind={reverseStyle} title={reverseBadge.sub || ''}>
              {reverseBadge.text}
              {reverseBadge.sub ? <span className="opacity-70">• {reverseBadge.sub}</span> : null}
            </Badge>

            <Badge kind={zoomBadgeKind} title={zoomBadgeTitle}>
              Zoom: {showMapPicker ? (mapZoom ?? '—') : '—'}
              {showMapPicker && mapZoom !== null ? (
                <span className="opacity-70">• {mapZoom >= REVERSE_ZOOM_MIN ? 'OK' : 'bas'}</span>
              ) : null}
            </Badge>
          </div>

          <div className="mt-1 text-xs text-slate-500">
            Reverse: &gt;{REVERSE_MIN_METERS}m + cooldown {REVERSE_COOLDOWN_MS}ms + zoom mini {REVERSE_ZOOM_MIN} si carte ouverte.
            {placeLoading ? ' (autocomplete…) ' : null}
            {reverseLoading ? ' (reverse…) ' : null}
            {placeErr ? <span className="text-red-600"> {placeErr}</span> : null}
          </div>

          {showPlaces && places.length > 0 ? (
            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              {places.map((p, i) => (
                <button
                  key={`${p.id}-${i}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectPlace(p)}
                  className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <div className="text-sm">
                    <div className="font-medium">{p.label}</div>
                    <div className="text-xs text-slate-500">
                      {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                    </div>
                  </div>
                  <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
                    {p.country_code ?? '—'}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Localisation */}
        <div className="rounded-2xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-sm font-medium">Localisation (lat/lng)</div>
              <div className="text-xs text-slate-500">Clic/drag → reverse (si ville déverrouillée).</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCityTouched(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Déverrouiller la ville
              </button>

              <button
                type="button"
                onClick={useMyLocation}
                disabled={geoLoading}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-60"
              >
                {geoLoading ? 'Localisation…' : 'Utiliser ma position'}
              </button>

              <button
                type="button"
                onClick={() => setShowMapPicker((v) => !v)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
              >
                {showMapPicker ? 'Fermer la carte' : 'Sélectionner sur la carte'}
              </button>

              <button
                type="button"
                onClick={clearCoords}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Effacer la position
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-600">Latitude</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={latStr}
                onChange={(e) => setLatStr(e.target.value)}
                placeholder="48.856600"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Longitude</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={lngStr}
                onChange={(e) => setLngStr(e.target.value)}
                placeholder="2.352200"
              />
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />
                Debug geo <span className="text-slate-500">(ou URL ?geoDebug=1)</span>
              </label>

              <button
                type="button"
                onClick={() => setDebugLines([])}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-100"
              >
                Clear
              </button>
            </div>

            {debug ? (
              <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-2 text-[11px] text-slate-700">
                {debugLines.length ? debugLines.join('\n') : 'Aucun log pour le moment.'}
              </pre>
            ) : null}
          </div>

          {showMapPicker ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
              <div className="h-[280px] w-full">
                <LeafletPicker
                  center={mapCenter}
                  zoom={mapZoomWanted}
                  marker={hasCoords ? { lat: latNum as number, lng: lngNum as number } : null}
                  recenterNonce={recenterNonce}
                  onZoom={setMapZoom}
                  onPick={(lat, lng) => {
                    setCityTouched(false)
                    setCoords(lat, lng, { recenter: true, reverse: true, reason: 'map_click' })
                  }}
                  onDragEnd={(lat, lng) => {
                    setCityTouched(false)
                    setCoords(lat, lng, { recenter: false, reverse: true, reason: 'marker_dragend' })
                  }}
                />
              </div>

              <div className="bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Clique pour placer • glisse le marker • badges + debug montrent l’état reverse et le zoom.
              </div>
            </div>
          ) : null}
        </div>

        {/* Budget */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Budget min (optionnel)</label>
            <input
              type="number"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={budgetMinStr}
              onChange={(e) => setBudgetMinStr(e.target.value)}
              min={0}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Budget max (optionnel)</label>
            <input
              type="number"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={budgetMaxStr}
              onChange={(e) => setBudgetMaxStr(e.target.value)}
              min={0}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? (isEdit ? 'Sauvegarde…' : 'Publication…') : isEdit ? 'Enregistrer' : 'Publier l’annonce'}
        </button>
      </div>
    </form>
  )
}
