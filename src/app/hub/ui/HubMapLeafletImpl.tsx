'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import * as L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMapEvents, useMap } from 'react-leaflet'

type Role = 'athlete' | 'coach' | 'admin'

type HubMapClientProps = {
  // on assouplit pour éviter l’erreur côté page.tsx si role/defaults viennent de DB
  role: Role | string
  defaultCountry?: string | null
  defaultLanguage?: string | null
}

type HubAd = {
  id: string
  title: string
  goal?: string | null
  sport?: string | null
  keywords?: any
  country?: string | null
  city?: string | null
  language?: string | null
  lat?: number | null
  lng?: number | null
  published_until?: string | null
  created_at?: string | null
  status?: string | null
}

function normCountry(v: any) {
  const s = String(v ?? '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(s) ? s : 'FR'
}

function normLang(v: any) {
  const s = String(v ?? '').trim().toLowerCase()
  return s || 'fr'
}

function clampText(s: any, max = 160) {
  const v = String(s ?? '').replace(/\s+/g, ' ').trim()
  if (!v) return ''
  return v.length > max ? v.slice(0, max).trim() + '…' : v
}

function asKeywords(raw: any): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean).slice(0, 20)
  if (typeof raw === 'object') return Object.values(raw).flat().map(String).filter(Boolean).slice(0, 20)
  return []
}

function bboxToString(bounds: L.LatLngBounds) {
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  return `${sw.lng.toFixed(6)},${sw.lat.toFixed(6)},${ne.lng.toFixed(6)},${ne.lat.toFixed(6)}`
}

function ensureLeafletIcons() {
  // Fix icônes marker en bundlers modernes
  // @ts-ignore
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

function BoundsWatcher({ onBBox }: { onBBox: (bbox: string) => void }) {
  useMapEvents({
    moveend: (e) => onBBox(bboxToString(e.target.getBounds())),
    zoomend: (e) => onBBox(bboxToString(e.target.getBounds())),
  })
  return null
}

// Permet de récupérer l’instance L.Map (sans utiliser m._map)
function MapRefBinder({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap()
  useEffect(() => {
    mapRef.current = map
    return () => {
      mapRef.current = null
    }
  }, [map, mapRef])
  return null
}

export default function HubMapClient({ role, defaultCountry, defaultLanguage }: HubMapClientProps) {
  const roleNorm: Role = role === 'coach' || role === 'admin' || role === 'athlete' ? (role as Role) : 'athlete'
  const isCoach = roleNorm === 'coach'
  const canShowAds = isCoach

  const [country, setCountry] = useState(() => normCountry(defaultCountry))
  const [language, setLanguage] = useState(() => normLang(defaultLanguage))
  const [q, setQ] = useState('')

  const [bbox, setBbox] = useState<string | null>(null)
  const [items, setItems] = useState<HubAd[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<number | null>(null)

  const markerRefs = useRef<Record<string, L.Marker | null>>({})
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    ensureLeafletIcons()
  }, [])

  const initialCenter = useMemo<[number, number]>(() => {
    // MVP: Paris par défaut
    return [48.8566, 2.3522]
  }, [])
  const initialZoom = 6

  const fetchAds = useCallback(async () => {
    if (!canShowAds) return

    setErr(null)
    setLoading(true)

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const sp = new URLSearchParams()
      sp.set('country', normCountry(country))
      sp.set('language', normLang(language))
      if (bbox) sp.set('bbox', bbox)
      if (q.trim()) sp.set('q', q.trim().slice(0, 80))

      const res = await fetch(`/api/hub/ads?${sp.toString()}`, {
        method: 'GET',
        signal: abortRef.current.signal,
        cache: 'no-store',
      })

      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || `HTTP ${res.status}`)
      }

      const json = await res.json()
      const list: HubAd[] = Array.isArray(json?.items) ? json.items : []
      const valid = list.filter((a) => typeof a.lat === 'number' && typeof a.lng === 'number')
      setItems(valid)

      if (!selectedId && valid.length) setSelectedId(valid[0].id)
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      setErr(e?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [bbox, canShowAds, country, language, q, selectedId])

  useEffect(() => {
    if (!canShowAds) return
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => fetchAds(), 350)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [bbox, country, language, q, fetchAds, canShowAds])

  const selected = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId])

  const onSelect = useCallback((ad: HubAd) => {
    setSelectedId(ad.id)

    const m = markerRefs.current[ad.id]
    if (m) {
      m.openPopup()
      mapRef.current?.panTo(m.getLatLng(), { animate: true })
    }
  }, [])

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
      {/* Top controls */}
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2">
            <span className="text-xs font-semibold text-white/70">Pays</span>
            <input
              className="w-16 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              maxLength={2}
              placeholder="FR"
            />
            <span className="text-xs font-semibold text-white/70">Lang</span>
            <input
              className="w-16 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              maxLength={12}
              placeholder="fr"
            />
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2">
            <span className="text-xs font-semibold text-white/70">Recherche</span>
            <input
              className="w-64 max-w-[60vw] bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ex: marathon, nutrition, sprint…"
            />
          </div>

          {canShowAds ? (
            <button
              type="button"
              onClick={fetchAds}
              className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Rafraîchir
            </button>
          ) : null}
        </div>

        <div className="text-xs text-white/70">
          {canShowAds ? (
            <>
              {loading ? 'Chargement…' : `${items.length} annonce(s)`}
              {err ? <span className="text-red-200"> • {err}</span> : null}
            </>
          ) : (
            'Côté athlète : couche coachs bientôt.'
          )}
        </div>
      </div>

      {/* Layout map + list */}
      <div className="grid gap-3 md:grid-cols-[1fr_360px]">
        {/* Map */}
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="h-[460px] w-full">
            <MapContainer center={initialCenter} zoom={initialZoom} className="h-full w-full">
              <MapRefBinder mapRef={mapRef} />

              <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <BoundsWatcher onBBox={(b) => setBbox(b)} />

              {canShowAds
                ? items.map((ad) => (
                    <Marker
                      key={ad.id}
                      position={[ad.lat as number, ad.lng as number]}
                      ref={(ref) => {
                        markerRefs.current[ad.id] = (ref as unknown as L.Marker) ?? null
                      }}
                      eventHandlers={{
                        click: () => setSelectedId(ad.id),
                      }}
                    >
                      <Popup>
                        <div className="space-y-1">
                          <div className="text-sm font-semibold">{ad.title}</div>
                          {ad.sport ? <div className="text-xs text-slate-600">Sport: {ad.sport}</div> : null}
                          {ad.goal ? <div className="text-xs text-slate-700">{clampText(ad.goal, 180)}</div> : null}
                          <div className="pt-2">
                            <Link href="/messages" className="text-xs font-semibold underline">
                              Ouvrir la messagerie
                            </Link>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))
                : null}
            </MapContainer>
          </div>
        </div>

        {/* Right list */}
        <aside className="rounded-2xl border border-white/10 bg-white/5 p-2">
          <div className="mb-2 flex items-center justify-between px-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Résultats</div>
            {selected ? (
              <div className="text-xs text-white/70">
                Sélection: <span className="font-semibold">{clampText(selected.title, 32)}</span>
              </div>
            ) : (
              <div className="text-xs text-white/60">—</div>
            )}
          </div>

          <div className="max-h-[420px] space-y-2 overflow-auto px-1 pb-1">
            {!canShowAds ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                Cette colonne affichera les coachs (couche “coaches”) côté athlète.
              </div>
            ) : items.length === 0 && !loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                Aucune annonce trouvée. Vérifie que des annonces existent avec <b>lat/lng</b> renseignés.
              </div>
            ) : null}

            {items.map((ad) => {
              const active = ad.id === selectedId
              const kws = asKeywords(ad.keywords)
              return (
                <button
                  key={ad.id}
                  type="button"
                  onClick={() => onSelect(ad)}
                  className={[
                    'w-full rounded-2xl border p-3 text-left transition',
                    active ? 'border-white/25 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-white">{clampText(ad.title, 70)}</div>
                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                      {ad.country || '—'}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-white/70">
                    {ad.sport ? `Sport: ${ad.sport}` : 'Sport: —'}
                    {ad.city ? ` • ${ad.city}` : ''}
                    {ad.language ? ` • ${String(ad.language).toUpperCase()}` : ''}
                  </div>

                  {ad.goal ? <div className="mt-2 text-xs text-white/75">{clampText(ad.goal, 120)}</div> : null}

                  {kws.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {kws.slice(0, 8).map((k) => (
                        <span
                          key={`${ad.id}-${k}`}
                          className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className="mt-2 px-2 text-[11px] text-white/55">
            ✅ bbox automatique sur move/zoom • source: <code className="text-white/70">/api/hub/ads</code>
          </div>
        </aside>
      </div>
    </div>
  )
}
