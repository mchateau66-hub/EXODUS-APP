// src/app/coach/athlete/[userId]/CoachAthleteCardClient.tsx
'use client'

import { useState } from 'react'
import type { CoachAthleteStatus } from '@prisma/client'

type CoachAthleteForClient = {
  coach_id: string
  status: CoachAthleteStatus
  labels: string[]
  nextFollowUpAt: string | null
  pinned: boolean
  coach: {
    id: string
    name: string
    slug: string
    subtitle: string | null
    avatarInitial: string | null
  }
}

type Props = {
  athleteId: string
  item: CoachAthleteForClient
}

const STATUS_OPTIONS: { value: CoachAthleteStatus; label: string }[] = [
  { value: 'LEAD', label: 'Lead' },
  { value: 'ACTIVE', label: 'Actif' },
  { value: 'TO_FOLLOW', label: 'À relancer' },
  { value: 'ENDED', label: 'Terminé' },
]

function formatDisplayDate(dateStr: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
}

export default function CoachAthleteCardClient({ athleteId, item }: Props) {
  const [status, setStatus] = useState<CoachAthleteStatus>(item.status)
  const [labelsInput, setLabelsInput] = useState(
    item.labels.join(', '),
  )
  const [pinned, setPinned] = useState<boolean>(item.pinned)
  const [nextFollowUpAt, setNextFollowUpAt] = useState<string>(
    item.nextFollowUpAt ? item.nextFollowUpAt.slice(0, 10) : '',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const coachInitial =
    item.coach.avatarInitial ??
    item.coach.name[0]?.toUpperCase() ??
    '?'

  const displayNext = formatDisplayDate(
    nextFollowUpAt ? nextFollowUpAt : item.nextFollowUpAt,
  )

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSavedAt(null)

    try {
      const labels = labelsInput
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean)

      const res = await fetch(`/api/coach/athletes/${athleteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachSlug: item.coach.slug,
          status,
          labels,
          pinned,
          nextFollowUpAt: nextFollowUpAt || null,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error || `Erreur ${res.status}`)
      }

      setSavedAt(new Date())
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-3 text-xs text-slate-700 shadow-sm">
      {/* Ligne coach + statut + pin */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-slate-50">
            {coachInitial}
          </div>
          <div>
            <div className="text-[12px] font-semibold text-slate-900">
              {item.coach.name}
            </div>
            {item.coach.subtitle && (
              <div className="text-[11px] text-slate-500">
                {item.coach.subtitle}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 text-right">
          <div className="flex items-center gap-1">
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as CoachAthleteStatus)
              }
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 focus:border-slate-900 focus:outline-none"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setPinned((p) => !p)}
              className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                pinned
                  ? 'bg-amber-100 text-amber-700 border border-amber-300'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              {pinned ? 'Épinglé' : 'Épingler'}
            </button>
          </div>

          {displayNext && (
            <span className="text-[10px] text-emerald-600">
              Prochaine relance : {displayNext}
            </span>
          )}
        </div>
      </div>

      {/* Ligne labels + date + boutons */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-slate-600">
            Tags (séparés par des virgules)
          </label>
          <input
            type="text"
            value={labelsInput}
            onChange={(e) => setLabelsInput(e.target.value)}
            placeholder="Ex : reprise, course à pied, lombalgie…"
            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 outline-none focus:border-slate-900 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-600">
              Prochaine relance
            </label>
            <input
              type="date"
              value={nextFollowUpAt}
              onChange={(e) => setNextFollowUpAt(e.target.value)}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 outline-none focus:border-slate-900 focus:bg-white"
            />
          </div>

          <div className="ml-auto flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {error && (
              <span className="text-[10px] text-rose-600">{error}</span>
            )}
            {savedAt && !error && (
              <span className="text-[10px] text-emerald-600">
                Enregistré ✓
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
