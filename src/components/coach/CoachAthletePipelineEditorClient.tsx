'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

type CoachAthleteStatus = 'LEAD' | 'ACTIVE' | 'TO_FOLLOW' | 'ENDED'

type InitialShape = {
  status?: CoachAthleteStatus | null
  pinned?: boolean | null
}

type Props = {
  athleteId: string

  // ✅ Nouveau format (compatible pipelineInitial)
  initial?: InitialShape | null

  // ✅ Ancien format (compat)
  initialStatus?: CoachAthleteStatus | null
  initialPinned?: boolean
}

type PatchOk = { ok: true; item: any }
type PatchErr = { ok: false; error: string; message?: string }

export default function CoachAthleteQuickActionsClient({
  athleteId,
  initial,
  initialStatus,
  initialPinned,
}: Props) {
  const router = useRouter()

  const initialState = useMemo(() => {
    const status = (initialStatus ?? initial?.status ?? 'LEAD') as CoachAthleteStatus
    const pinned = !!(initialPinned ?? initial?.pinned ?? false)
    return { status, pinned }
  }, [initial, initialPinned, initialStatus])

  // ✅ état courant (optimiste)
  const [status, setStatus] = useState<CoachAthleteStatus>(initialState.status)
  const [pinned, setPinned] = useState<boolean>(initialState.pinned)

  // ✅ dernier état "commit" (sert au rollback)
  const [committed, setCommitted] = useState(initialState)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function patch(payload: Record<string, unknown>, rollbackTo: typeof committed) {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/coach/athletes/${encodeURIComponent(athleteId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const raw: unknown = await res.json().catch(() => null)
      const data: PatchOk | PatchErr | null =
        raw && typeof raw === 'object' ? (raw as any) : null

      if (!res.ok || !data || data.ok === false) {
        const msg =
          (data && 'message' in data && data.message) ||
          (data && 'error' in data && data.error) ||
          `Erreur (code ${res.status})`

        // ✅ rollback UI
        setStatus(rollbackTo.status)
        setPinned(rollbackTo.pinned)

        setError(String(msg))
        return
      }

      // ✅ commit réussi
      setCommitted({ status, pinned })
      router.refresh()
    } catch (e: any) {
      // ✅ rollback UI
      setStatus(rollbackTo.status)
      setPinned(rollbackTo.pinned)

      setError(e?.message ?? 'Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="flex flex-col items-end gap-2"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()

            const rollbackTo = committed
            const next = !pinned

            // ✅ optimiste
            setPinned(next)

            void patch({ pinned: next }, rollbackTo)
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
          onChange={(e) => {
            const rollbackTo = committed
            const next = e.target.value as CoachAthleteStatus

            // ✅ optimiste
            setStatus(next)

            void patch({ status: next }, rollbackTo)
          }}
          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          title="Changer le statut"
        >
          <option value="LEAD">LEAD</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="TO_FOLLOW">TO_FOLLOW</option>
          <option value="ENDED">ENDED</option>
        </select>
      </div>

      {error && (
        <div className="max-w-[220px] text-right text-[10px] text-red-600">
          {error}
        </div>
      )}
    </div>
  )
}
