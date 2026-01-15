'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

type MyAd = {
  id: string
  title: string
  sport?: string | null
  city?: string | null
  country?: string | null
  language?: string | null
  lat?: number | null
  lng?: number | null
  status?: string | null
  published_until?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type SortMode = 'smart' | 'urgent' | 'visible' | 'recent'

const EXPIRY_SOON_DAYS = 7
const EXPIRY_URGENT_DAYS = 2

// ✅ LocalStorage prefs
const PREFS_KEY = 'myads:prefs:v1'
const ALLOWED_SORT: SortMode[] = ['smart', 'urgent', 'visible', 'recent']

function parseTime(s?: string | null) {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : t
}

function formatUntil(published_until?: string | null) {
  const t = parseTime(published_until)
  if (t == null) return '—'
  try {
    return new Date(t).toLocaleDateString()
  } catch {
    return '—'
  }
}

function isCoordsOK(ad: MyAd) {
  return typeof ad.lat === 'number' && typeof ad.lng === 'number'
}

function daysLeft(published_until?: string | null): number | null {
  const t = parseTime(published_until)
  if (t == null) return null
  const diff = t - Date.now()
  if (diff <= 0) return 0
  return Math.ceil(diff / 86_400_000)
}

function isExpired(published_until?: string | null) {
  const t = parseTime(published_until)
  if (t == null) return false
  return t <= Date.now()
}

function badgeStatus(ad: MyAd) {
  const status = String(ad.status ?? 'active')
  const expired = isExpired(ad.published_until)
  if (status === 'inactive') return { label: 'Désactivée', cls: 'bg-white/10 text-white/80' }
  if (expired) return { label: 'Expirée', cls: 'bg-orange-500/15 text-orange-100' }
  return { label: 'Active', cls: 'bg-emerald-500/15 text-emerald-100' }
}

function getVisibility(ad: MyAd) {
  const status = String(ad.status ?? 'active')
  const expired = isExpired(ad.published_until)
  const coordsOK = isCoordsOK(ad)

  const visible = status === 'active' && !expired && coordsOK

  let reason: string | null = null
  if (!visible) {
    if (status !== 'active') reason = 'désactivée'
    else if (expired) reason = 'expirée'
    else if (!coordsOK) reason = 'coordonnées manquantes'
    else reason = 'non visible'
  }

  return { visible, reason, status, expired, coordsOK }
}

/**
 * Badge "Expire dans X jours" (même si inactive)
 * Rouge si <= 2 jours.
 */
function expiryBadge(ad: MyAd): { label: string; cls: string; title?: string } | null {
  const d = daysLeft(ad.published_until)
  if (d == null) return null
  if (d <= 0) return null
  if (d > EXPIRY_SOON_DAYS) return null

  const status = String(ad.status ?? 'active')
  const inactiveHint = status === 'inactive' ? ' (annonce désactivée)' : ''
  const opacity = status === 'inactive' ? ' opacity-80' : ''

  if (d <= EXPIRY_URGENT_DAYS) {
    return {
      label: `⚠️ Expire dans ${d}j`,
      cls: `bg-red-500/15 text-red-100${opacity}`,
      title: `Expire bientôt${inactiveHint}`,
    }
  }

  return {
    label: `Expire dans ${d}j`,
    cls: `bg-amber-500/15 text-amber-100${opacity}`,
    title: `Expire bientôt${inactiveHint}`,
  }
}

function safeCreatedAt(ad: MyAd) {
  return parseTime(ad.created_at) ?? 0
}

/** published_until optimiste (même logique que l’API: base = max(now, currentUntil)) */
function computePublishedUntilOptimistic(currentUntil?: string | null, durationDays = 30) {
  const now = Date.now()
  const cur = parseTime(currentUntil) ?? 0
  const base = Math.max(now, cur)
  const ms = durationDays * 24 * 60 * 60 * 1000
  return new Date(base + ms).toISOString()
}

function norm(s: any) {
  return String(s ?? '').trim().toLowerCase()
}

function matchesQuery(ad: MyAd, q: string) {
  const query = norm(q)
  if (!query) return true

  const hay = [ad.title, ad.sport, ad.city, ad.country, ad.language]
    .map(norm)
    .filter(Boolean)
    .join(' • ')

  return hay.includes(query)
}

function readPrefs(): { q?: string; hideNonVisible?: boolean; sortMode?: SortMode } {
  try {
    if (typeof window === 'undefined') return {}
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return {}
    const obj = JSON.parse(raw)

    const next: { q?: string; hideNonVisible?: boolean; sortMode?: SortMode } = {}

    if (typeof obj?.q === 'string') next.q = obj.q.slice(0, 120)
    if (typeof obj?.hideNonVisible === 'boolean') next.hideNonVisible = obj.hideNonVisible
    if (typeof obj?.sortMode === 'string' && (ALLOWED_SORT as string[]).includes(obj.sortMode)) next.sortMode = obj.sortMode

    return next
  } catch {
    return {}
  }
}

function writePrefs(p: { q: string; hideNonVisible: boolean; sortMode: SortMode }) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    // ignore
  }
}

function clearPrefs() {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(PREFS_KEY)
  } catch {
    // ignore
  }
}

export default function MyAdsClient() {
  const [items, setItems] = useState<MyAd[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, boolean>>({})

  // ✅ Search + filtre + tri (persistés)
  const [q, setQ] = useState('')
  const [hideNonVisible, setHideNonVisible] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('smart')

  // ✅ load prefs on mount
  useEffect(() => {
    const p = readPrefs()
    if (typeof p.q === 'string') setQ(p.q)
    if (typeof p.hideNonVisible === 'boolean') setHideNonVisible(p.hideNonVisible)
    if (p.sortMode) setSortMode(p.sortMode)
  }, [])

  // ✅ save prefs on change
  useEffect(() => {
    writePrefs({ q, hideNonVisible, sortMode })
  }, [q, hideNonVisible, sortMode])

  const abortRef = useRef<AbortController | null>(null)
  const didAutoScrollRef = useRef(false)

  const refresh = useCallback(async () => {
    setErr(null)
    setLoading(true)

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/ads', { cache: 'no-store', signal: abortRef.current.signal })
      if (!res.ok) throw new Error((await res.text().catch(() => '')) || `HTTP ${res.status}`)
      const json = await res.json()

      const next = Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : []
      setItems(next)
      didAutoScrollRef.current = false
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      setErr(e?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    return () => abortRef.current?.abort()
  }, [refresh])

  const enriched = useMemo(() => {
    return items.map((ad) => {
      const vis = getVisibility(ad)
      const dleft = daysLeft(ad.published_until)
      const isUrgent = dleft != null && dleft > 0 && dleft <= EXPIRY_URGENT_DAYS
      const isSoon = dleft != null && dleft > 0 && dleft <= EXPIRY_SOON_DAYS
      const expBadge = expiryBadge(ad)
      return { ad, vis, dleft, isUrgent, isSoon, expBadge }
    })
  }, [items])

  const visibleCount = useMemo(() => enriched.filter((x) => x.vis.visible).length, [enriched])

  // ✅ Filtre search
  const filtered = useMemo(() => {
    const query = q.trim()
    if (!query) return enriched
    return enriched.filter((x) => matchesQuery(x.ad, query))
  }, [enriched, q])

  // ✅ Comparateurs de tri
  const cmpSmart = useCallback((a: any, b: any) => {
    if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1
    if (a.vis.expired !== b.vis.expired) return a.vis.expired ? -1 : 1
    if (a.isSoon !== b.isSoon) return a.isSoon ? -1 : 1
    if (a.vis.visible !== b.vis.visible) return a.vis.visible ? -1 : 1
    return safeCreatedAt(b.ad) - safeCreatedAt(a.ad)
  }, [])

  const cmpUrgent = useCallback((a: any, b: any) => {
    const aKey = a.isUrgent ? 0 : a.vis.expired ? 1 : a.isSoon ? 2 : 3
    const bKey = b.isUrgent ? 0 : b.vis.expired ? 1 : b.isSoon ? 2 : 3
    if (aKey !== bKey) return aKey - bKey
    return safeCreatedAt(b.ad) - safeCreatedAt(a.ad)
  }, [])

  const cmpVisible = useCallback((a: any, b: any) => {
    if (a.vis.visible !== b.vis.visible) return a.vis.visible ? -1 : 1
    if (a.isSoon !== b.isSoon) return a.isSoon ? -1 : 1
    if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1
    if (a.vis.expired !== b.vis.expired) return a.vis.expired ? -1 : 1
    return safeCreatedAt(b.ad) - safeCreatedAt(a.ad)
  }, [])

  const cmpRecent = useCallback((a: any, b: any) => safeCreatedAt(b.ad) - safeCreatedAt(a.ad), [])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    const cmp =
      sortMode === 'urgent'
        ? cmpUrgent
        : sortMode === 'visible'
        ? cmpVisible
        : sortMode === 'recent'
        ? cmpRecent
        : cmpSmart

    arr.sort(cmp)
    return arr
  }, [filtered, sortMode, cmpSmart, cmpUrgent, cmpVisible, cmpRecent])

  // ✅ "À relancer" : urgent OU expirée (toujours visible, même si hideNonVisible)
  const urgentList = useMemo(() => sorted.filter((x) => x.isUrgent || x.vis.expired), [sorted])

  // ✅ Le reste (sans doublons)
  const restBase = useMemo(() => {
    const urgentIds = new Set(urgentList.map((x) => x.ad.id))
    return sorted.filter((x) => !urgentIds.has(x.ad.id))
  }, [sorted, urgentList])

  // ✅ toggle "masquer non visibles" (n'affecte pas "À relancer")
  const restList = useMemo(() => {
    if (!hideNonVisible) return restBase
    return restBase.filter((x) => x.vis.visible)
  }, [restBase, hideNonVisible])

  const filteredCount = useMemo(() => {
    const ids = new Set<string>()
    for (const x of urgentList) ids.add(x.ad.id)
    for (const x of restList) ids.add(x.ad.id)
    return ids.size
  }, [urgentList, restList])

  // ✅ auto-scroll vers la 1ère urgente après refresh (only smart + no search)
  useEffect(() => {
    if (loading) return
    if (didAutoScrollRef.current) return
    if (!urgentList.length) return
    if (q.trim()) return
    if (sortMode !== 'smart') return

    const first = urgentList[0]?.ad?.id
    if (!first) return

    const el = document.getElementById(`ad-${first}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      didAutoScrollRef.current = true
    }
  }, [loading, urgentList, q, sortMode])

  // ✅ PATCH optimiste + merge réponse
  const patch = useCallback(
    async (id: string, action: 'deactivate' | 'activate', durationDays?: number) => {
      setErr(null)
      setPending((p) => ({ ...p, [id]: true }))

      setItems((prev) =>
        prev.map((ad) => {
          if (ad.id !== id) return ad
          if (action === 'deactivate') {
            return { ...ad, status: 'inactive', published_until: new Date().toISOString() }
          }
          const d = typeof durationDays === 'number' ? durationDays : 30
          return { ...ad, status: 'active', published_until: computePublishedUntilOptimistic(ad.published_until, d) }
        })
      )

      try {
        const res = await fetch(`/api/ads/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, durationDays }),
        })
        if (!res.ok) throw new Error((await res.text().catch(() => '')) || `HTTP ${res.status}`)
        const json = await res.json().catch(() => null)
        const item = json?.item
        if (item?.id) setItems((prev) => prev.map((ad) => (ad.id === item.id ? { ...ad, ...item } : ad)))
      } catch (e: any) {
        setErr(e?.message || 'Erreur')
        await refresh()
      } finally {
        setPending((p) => {
          const next = { ...p }
          delete next[id]
          return next
        })
      }
    },
    [refresh]
  )

  const relaunchDays = [7, 30, 90] as const

  const ActionBtn = ({
    children,
    onClick,
    disabled,
    variant = 'default',
    title,
  }: {
    children: ReactNode
    onClick?: () => void
    disabled?: boolean
    variant?: 'default' | 'urgent'
    title?: string
  }) => {
    const base =
      'rounded-2xl border px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-60'
    const cls =
      variant === 'urgent'
        ? 'border-red-300/40 bg-red-500/20 hover:bg-red-500/25'
        : 'border-white/15 bg-white/10 hover:bg-white/15'
    return (
      <button type="button" title={title} disabled={disabled} onClick={onClick} className={`${base} ${cls}`}>
        {children}
      </button>
    )
  }

  const renderCard = (row: (typeof enriched)[number]) => {
    const { ad, vis, dleft, isUrgent, expBadge } = row
    const b = badgeStatus(ad)

    const canDeactivate = vis.status === 'active' && !vis.expired
    const canActivate = vis.status !== 'active' || vis.expired

    const isPending = !!pending[ad.id]
    const relaunchVariant: 'default' | 'urgent' = isUrgent || vis.expired ? 'urgent' : 'default'
    const relaunchLabelCls = isUrgent || vis.expired ? 'text-red-200' : 'text-white/60'

    return (
      <div id={`ad-${ad.id}`} key={ad.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-white">{ad.title}</div>

              {vis.visible ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-100">
                  Visible sur la map coach
                </span>
              ) : (
                <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/80">
                  Non visible ({vis.reason})
                </span>
              )}

              {expBadge ? (
                <span
                  title={expBadge.title}
                  className={`rounded-full px-2 py-1 text-[11px] font-semibold ${expBadge.cls}`}
                >
                  {expBadge.label}
                </span>
              ) : null}

              {dleft != null && dleft > 0 && dleft <= EXPIRY_SOON_DAYS ? (
                <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/70">
                  J-{dleft}
                </span>
              ) : null}
            </div>

            <div className="mt-1 text-xs text-white/70">
              {ad.sport ? `Sport: ${ad.sport}` : 'Sport: —'}
              {ad.city ? ` • ${ad.city}` : ''}
              {ad.country ? ` • ${ad.country}` : ''}
              {ad.language ? ` • ${String(ad.language).toUpperCase()}` : ''}
            </div>

            <div className="mt-1 text-[11px] text-white/55">
              coords: {vis.coordsOK ? 'OK' : 'manquantes'} • jusqu’au: {formatUntil(ad.published_until)}
            </div>
          </div>

          <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${b.cls}`}>
            {b.label}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href={`/ads/${ad.id}/edit`}
            className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
          >
            Modifier
          </Link>

          {canDeactivate ? (
            <ActionBtn
              disabled={isPending}
              onClick={() => patch(ad.id, 'deactivate')}
              variant="default"
              title="Désactive l’annonce (et la rend expirée immédiatement)"
            >
              Désactiver
            </ActionBtn>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[11px] font-semibold ${relaunchLabelCls}`}>
              {canActivate ? 'Relancer' : 'Prolonger'}
              {isUrgent || vis.expired ? ' (urgent)' : ''}
            </span>

            {relaunchDays.map((d) => (
              <ActionBtn
                key={`${ad.id}-${d}`}
                disabled={isPending}
                onClick={() => patch(ad.id, 'activate', d)}
                variant={relaunchVariant}
                title={vis.expired ? 'Annonce expirée: relancer' : isUrgent ? 'Expire bientôt: prolonger' : 'Prolonger'}
              >
                {d}j
              </ActionBtn>
            ))}
          </div>
        </div>

        {!vis.coordsOK ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-2 text-xs text-white/70">
            ⚠️ Pour apparaître sur la map coach,{' '}
            <Link href={`/ads/${ad.id}/edit`} className="font-semibold underline">
              édite l’annonce
            </Link>{' '}
            et renseigne une localisation (lat/lng).
          </div>
        ) : null}
      </div>
    )
  }

  const isDirty = q.trim() !== '' || hideNonVisible || sortMode !== 'smart'

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      {/* Header + controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Mes annonces</div>
          <div className="mt-1 text-xs text-white/70">
            {loading ? 'Chargement…' : `${items.length} annonce(s) • visibles map coach: ${visibleCount}`}
            {isDirty ? <span> • affichées: {filteredCount}</span> : null}
            {err ? <span className="text-red-200"> • {err}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2">
            <span className="text-xs font-semibold text-white/70">Recherche</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="titre, sport, ville…"
              className="w-56 max-w-[55vw] bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
            {q.trim() ? (
              <button
                type="button"
                onClick={() => setQ('')}
                className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/70 hover:bg-white/10"
              >
                Clear
              </button>
            ) : null}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2">
            <span className="text-xs font-semibold text-white/70">Trier</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="bg-transparent text-sm text-white outline-none"
            >
              <option value="smart">Intelligent</option>
              <option value="urgent">Urgent</option>
              <option value="visible">Visible</option>
              <option value="recent">Plus récent</option>
            </select>
          </div>

          {/* Toggle */}
          <label className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={hideNonVisible}
              onChange={(e) => setHideNonVisible(e.target.checked)}
            />
            Masquer non visibles
          </label>

          {/* Reset */}
          {isDirty ? (
            <button
              type="button"
              onClick={() => {
                setQ('')
                setHideNonVisible(false)
                setSortMode('smart')
                clearPrefs()
              }}
              className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Réinitialiser
            </button>
          ) : null}

          <button
            type="button"
            onClick={refresh}
            className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
          >
            Rafraîchir
          </button>

          <Link
            href="/ads/new"
            className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
          >
            Créer
          </Link>
        </div>
      </div>

      <div className="mt-2 text-[11px] text-white/55">
        ℹ️ “Masquer non visibles” n’affecte pas <b>À relancer</b> (pour ne pas cacher l’actionnable).<br />
        ✅ Les filtres/tri sont sauvegardés automatiquement (localStorage).
      </div>

      {/* Lists */}
      <div className="mt-4 space-y-3">
        {items.length === 0 && !loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
            Tu n’as aucune annonce pour l’instant. Clique sur <b>Créer</b>.
          </div>
        ) : null}

        {/* ✅ Section À relancer */}
        {urgentList.length ? (
          <div className="rounded-2xl border border-red-300/20 bg-red-500/5 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-red-200/90">
                À relancer
              </div>
              <div className="text-[11px] text-white/70">
                {urgentList.length} annonce(s) (≤{EXPIRY_URGENT_DAYS}j ou expirée)
              </div>
            </div>
            <div className="space-y-2">{urgentList.map(renderCard)}</div>
          </div>
        ) : null}

        {/* ✅ Le reste */}
        {restList.length ? (
          <div className="space-y-2">
            <div className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              Toutes les annonces
            </div>
            {restList.map(renderCard)}
          </div>
        ) : null}

        {/* ✅ empty state after filters */}
        {items.length > 0 && urgentList.length === 0 && restList.length === 0 && !loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
            Aucun résultat avec ces filtres.
          </div>
        ) : null}
      </div>
    </div>
  )
}
