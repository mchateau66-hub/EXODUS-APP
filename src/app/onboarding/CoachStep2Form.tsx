// src/app/onboarding/CoachStep2Form.tsx
'use client'

import { useState, FormEvent } from 'react'

type CoachStep2FormValues = {
  highestDiploma: string
  otherDiploma: string
  certifications: string
  yearsExperience: string
  worksOnline: string
  worksInPerson: string
}

const DIPLOMAS = [
  'Aucun diplôme',
  'BPJEPS',
  'Licence STAPS',
  'Master STAPS',
  'Diplôme fédéral / fédé sportive',
  'Autre',
]

const EXPERIENCE = ['0-2 ans', '3-5 ans', '6-10 ans', '10+ ans']

export default function CoachStep2Form() {
  const [form, setForm] = useState<CoachStep2FormValues>({
    highestDiploma: '',
    otherDiploma: '',
    certifications: '',
    yearsExperience: '',
    worksOnline: 'oui',
    worksInPerson: 'non',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof CoachStep2FormValues>(
    key: K,
    value: CoachStep2FormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (submitted) setSubmitted(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const answers = { ...form }

    try {
      const res = await fetch('/api/onboarding/step-2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Erreur inconnue')
        return
      }

      setSubmitted(true)
      // plus tard: rediriger vers /onboarding/step-3
      // router.push('/onboarding/step-3')
    } catch (err) {
      console.error('Erreur onboarding coach step 2', err)
      setError(
        'Impossible denregistrer tes informations pour le moment. Réessaie dans un instant.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit =
    form.highestDiploma !== '' && form.yearsExperience !== '' && !submitting

  const showOtherDiploma = form.highestDiploma === 'Autre'

  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Onboarding coach — Étape 2
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Partage tes qualifications de coach
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Ces informations serviront de base au contrôle interne et à la
          confiance des athlètes (diplômes, certifs, expérience).
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Diplôme principal */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-800">
            Ton diplôme principal en lien avec le coaching
          </label>
          <select
            value={form.highestDiploma}
            onChange={(e) => update('highestDiploma', e.target.value)}
            className="border rounded-md px-3 py-2 w-full text-sm"
          >
            <option value="">Sélectionne une option</option>
            {DIPLOMAS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {showOtherDiploma && (
            <input
              type="text"
              value={form.otherDiploma}
              onChange={(e) => update('otherDiploma', e.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Précise ton diplôme principal…"
            />
          )}
        </div>

        {/* Certifications */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-800">
            Autres certifications / formations (optionnel)
          </label>
          <textarea
            value={form.certifications}
            onChange={(e) => update('certifications', e.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Liste tes certifs, formations continues, spécialités (ex : nutrition, prépa mentale, etc.)."
          />
        </div>

        {/* Expérience */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-800">
            Ton expérience globale en coaching
          </label>
          <select
            value={form.yearsExperience}
            onChange={(e) => update('yearsExperience', e.target.value)}
            className="border rounded-md px-3 py-2 w-full text-sm"
          >
            <option value="">Sélectionne une option</option>
            {EXPERIENCE.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        {/* Modalités de travail */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-800">
              Tu coaches à distance ?
            </label>
            <select
              value={form.worksOnline}
              onChange={(e) => update('worksOnline', e.target.value)}
              className="border rounded-md px-3 py-2 w-full text-sm"
            >
              <option value="oui">Oui</option>
              <option value="non">Non</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-800">
              Tu coaches aussi en présentiel ?
            </label>
            <select
              value={form.worksInPerson}
              onChange={(e) => update('worksInPerson', e.target.value)}
              className="border rounded-md px-3 py-2 w-full text-sm"
            >
              <option value="non">Non</option>
              <option value="oui">Oui</option>
            </select>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600">
            {error}
          </p>
        )}

        <div className="space-y-2 pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full inline-flex items-center justify-center rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? 'Enregistrement…' : 'Valider cette étape'}
          </button>

          {submitted && (
            <p className="text-xs text-emerald-600">
              Informations enregistrées pour vérification. Tu pourras les
              compléter plus tard si besoin.
            </p>
          )}
        </div>
      </form>
    </>
  )
}
