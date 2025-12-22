'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type SyntheticEvent } from 'react'

type CoachAthleteStatus = 'LEAD' | 'ACTIVE' | 'TO_FOLLOW' | 'ENDED'

type OptimisticUpdate = Partial<{
  status: CoachAthleteStatus | null
  pinned: boolean
  labels: string[]
  nextFollowUpAt: string | null // ISO
}>

// ✅ Nouveau: objet initial complet (compatible pipelineInitial)
type InitialAll = {
  status?: CoachAthleteStatus | null
  pinned?: boolean
  labels?: string[]
  nextFollowUpAt?: string | null
}

type Props = {
  athleteId: string
  coachSlug?: string // optionnel (utile admin), ignoré côté API si role coach

  // ✅ Nouveau format
  initial?: InitialAll | null

  // ✅ Ancien format (on le garde pour ne rien casser)
  initialStatus?: CoachAthleteStatus | null
  initialPinned?: boolean
  initialLabels?: string[]
  initialNextFollowUpAt?: string | null // ISO

  onOptimisticUpdate?: (u: OptimisticUpdate) => void
  refreshOnSuccess?: boolean
}

type PatchOk = { ok: true; item: unknown }
type PatchErr = { ok: false; error: string; message?: string }
type PatchResponse = PatchOk | PatchErr

// ✅ Fallback stable (évite le "?? []" qui recrée un array à chaque render)
const EMPTY_LABELS: string[] = []

function toLocalDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function safeIsoToDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return toLocalDateInputValue(d)
}

function parseLabels(text: string): string[] {
  const raw = text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const unique: string[] = []
  const seen = new Set<string>()

  for (const l of raw) {
    const k = l.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    unique.push(l)
    if (unique.length >= 12) break
  }

  return unique
}

function isoFromDateInputOrNull(dateValue: string): string | null {
  if (!dateValue) return null
  // 12:00 local pour éviter les décalages “jour précédent/suivant”
  const d = new Date(`${dateValue}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export default function CoachAthleteQuickActionsClient(props: Props) {
  const router = useRouter()

  const { athleteId, coachSlug, onOptimisticUpdate, refreshOnSuccess = false } = props

  // ✅ Valeurs initiales (compat old props + new initial={...}) — memo = deps stables
  const initStatus = useMemo(
    () => (props.initialStatus ?? props.initial?.status ?? 'LEAD') as CoachAthleteStatus,
    [props.initialStatus, props.initial?.status],
  )

  const initPinned = useMemo(
    () => Boolean(props.initialPinned ?? props.initial?.pinned ?? false),
    [props.initialPinned, props.initial?.pinned],
  )

  const initLabels = useMemo(
    () => (props.initialLabels ?? props.initial?.labels ?? EMPTY_LABELS) as string[],
    [props.initialLabels, props.initial?.labels],
  )

  const initNextFollowUpAt = useMemo(
    () => (props.initialNextFollowUpAt ?? props.initial?.nextFollowUpAt ?? null) as string | null,
    [props.initialNextFollowUpAt, props.initial?.nextFollowUpAt],
  )

  // ✅ “Committed” = dernière valeur connue (après succès patch)
  const [status, setStatus] = useState<CoachAthleteStatus>(initStatus)
  const [pinned, setPinned] = useState<boolean>(initPinned)
  const [labels, setLabels] = useState<string[]>(initLabels)
  const [nextFollowUpAt, setNextFollowUpAt] = useState<string | null>(initNextFollowUpAt)

  // ✅ UI editor (draft)
  const [open, setOpen] = useState(false)
  const [labelsText, setLabelsText] = useState(() => initLabels.join(', '))
  const initialDateValue = useMemo(() => safeIsoToDateInput(initNextFollowUpAt), [initNextFollowUpAt])
  const [dateValue, setDateValue] = useState<string>(() => initialDateValue)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ✅ clé stable pour resync quand labels changent après refresh
  const labelsKey = useMemo(() => initLabels.map((s) => s.toLowerCase()).join('|'), [initLabels])

  // ✅ Resync si l’athlète OU les valeurs initiales changent (ex: router.refresh)
  useEffect(() => {
    setStatus(initStatus)
    setPinned(initPinned)
    setLabels(initLabels)
    setNextFollowUpAt(initNextFollowUpAt)

    // reset draft
    setOpen(false)
    setLabelsText(initLabels.join(', '))
    setDateValue(safeIsoToDateInput(initNextFollowUpAt))
    setError(null)
  }, [athleteId, initStatus, initPinned, initNextFollowUpAt, labelsKey, initLabels])

  // 🔒 empêcher le click sur la card <Link>
  function stop(e: SyntheticEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  async function patch(payload: Record<string, unknown>): Promise<boolean> {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/coach/athletes/${encodeURIComponent(athleteId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(coachSlug ? { coachSlug } : {}),
          ...payload,
        }),
      })

      const raw: unknown = await res.json().catch(() => null)
      const data: PatchResponse | null = raw && typeof raw === 'object' ? (raw as PatchResponse) : null

      if (!res.ok || !data || data.ok === false) {
        const msg =
          (data &&
            typeof data === 'object' &&
            'message' in data &&
            typeof (data as any).message === 'string' &&
            (data as any).message) ||
          (data &&
            typeof data === 'object' &&
            'error' in data &&
            typeof (data as any).error === 'string' &&
            (data as any).error) ||
          `Erreur (code ${res.status})`

        setError(String(msg))
        return false
      }

      if (refreshOnSuccess) router.refresh()
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
      return false
    } finally {
      setSaving(false)
    }
  }

  // ✅ Retourne un bool pour savoir si on peut fermer l’éditeur
  async function optimistic(
    apply: () => void,
    rollback: () => void,
    request: () => Promise<boolean>,
  ): Promise<boolean> {
    apply()
    const ok = await request()
    if (!ok) rollback()
    return ok
  }

  function openEditor() {
    // ✅ Quand on ouvre, on repart des valeurs committed
    setLabelsText((labels ?? []).join(', '))
    setDateValue(safeIsoToDateInput(nextFollowUpAt))
    setOpen(true)
  }

  async function handleSaveDetails() {
    const nextLabels = parseLabels(labelsText)
    const nextIso = isoFromDateInputOrNull(dateValue)

    const prevCommitted = {
      labels,
      nextFollowUpAt,
      labelsText: (labels ?? []).join(', '),
      dateValue: safeIsoToDateInput(nextFollowUpAt),
    }

    const ok = await optimistic(
      () => {
        setLabels(nextLabels)
        setNextFollowUpAt(nextIso)
        onOptimisticUpdate?.({ labels: nextLabels, nextFollowUpAt: nextIso })
      },
      () => {
        setLabels(prevCommitted.labels)
        setNextFollowUpAt(prevCommitted.nextFollowUpAt)
        setLabelsText(prevCommitted.labelsText)
        setDateValue(prevCommitted.dateValue)
        onOptimisticUpdate?.({
          labels: prevCommitted.labels,
          nextFollowUpAt: prevCommitted.nextFollowUpAt,
        })
      },
      () => patch({ labels: nextLabels, nextFollowUpAt: nextIso }),
    )

    if (ok) setOpen(false)
  }

  return (
    <div
      className="flex flex-col items-end gap-2"
      onClick={stop}
      onMouseDown={stop}
      onPointerDown={stop}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={async (e) => {
            stop(e)
            const prev = pinned
            const next = !pinned

            await optimistic(
              () => {
                setPinned(next)
                onOptimisticUpdate?.({ pinned: next })
              },
              () => {
                setPinned(prev)
                onOptimisticUpdate?.({ pinned: prev })
              },
              () => patch({ pinned: next }),
            )
          }}
          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
            pinned
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          } disabled:cursor-not-allowed disabled:opacity-60`}
          title={pinned ? 'Désépingler' : 'Épingler'}
        >
          {pinned ? '📌 Épinglé' : '📌 Épingler'}
        </button>

        <select
          value={status}
          disabled={saving}
          onChange={async (e) => {
            const prev = status
            const next = e.target.value as CoachAthleteStatus

            await optimistic(
              () => {
                setStatus(next)
                onOptimisticUpdate?.({ status: next })
              },
              () => {
                setStatus(prev)
                onOptimisticUpdate?.({ status: prev })
              },
              () => patch({ status: next }),
            )
          }}
          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          title="Changer le statut"
        >
          <option value="LEAD">LEAD</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="TO_FOLLOW">TO_FOLLOW</option>
          <option value="ENDED">ENDED</option>
        </select>

        <button
          type="button"
          disabled={saving}
          onClick={(e) => {
            stop(e)
            if (open) setOpen(false)
            else openEditor()
          }}
          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          title="Éditer tags et relance"
        >
          {open ? 'Fermer' : 'Éditer'}
        </button>
      </div>

      {open && (
        <div className="w-[260px] rounded-2xl border border-slate-200 bg-white p-3 text-[11px] text-slate-700 shadow-sm">
          <label className="mb-1 block text-[10px] font-semibold text-slate-500">
            Tags (séparés par des virgules)
          </label>
          <input
            value={labelsText}
            onChange={(e) => setLabelsText(e.target.value)}
            placeholder="ex: blessure, nutrition, 3x/semaine"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[11px] outline-none focus:border-slate-900"
            disabled={saving}
          />

          <div className="mt-3">
            <label className="mb-1 block text-[10px] font-semibold text-slate-500">
              Prochaine relance
            </label>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-[11px] outline-none focus:border-slate-900"
                disabled={saving}
              />

              <button
                type="button"
                disabled={saving || !dateValue}
                onClick={async (e) => {
                  stop(e)
                  const prevCommitted = { nextFollowUpAt, dateValue }

                  await optimistic(
                    () => {
                      setDateValue('')
                      setNextFollowUpAt(null)
                      onOptimisticUpdate?.({ nextFollowUpAt: null })
                    },
                    () => {
                      setDateValue(prevCommitted.dateValue)
                      setNextFollowUpAt(prevCommitted.nextFollowUpAt)
                      onOptimisticUpdate?.({ nextFollowUpAt: prevCommitted.nextFollowUpAt })
                    },
                    () => patch({ nextFollowUpAt: null }),
                  )
                }}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                title="Supprimer la relance"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={(e) => {
                stop(e)
                setOpen(false)
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              Fermer
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={(e) => {
                stop(e)
                void handleSaveDetails()
              }}
              className="rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </div>

          {error && <div className="mt-2 text-right text-[10px] text-red-600">{error}</div>}
        </div>
      )}

      {!open && error && <div className="max-w-[260px] text-right text-[10px] text-red-600">{error}</div>}
    </div>
  )
}
