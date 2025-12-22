// src/app/onboarding/AthletePersonaForm.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type AthleteFormValues = {
  profileVisibility: 'public' | 'semi_public' | 'private'
  socialRole: string
  personaType: string
}

export default function AthletePersonaForm() {
  const router = useRouter()
  const [values, setValues] = useState<AthleteFormValues>({
    profileVisibility: 'semi_public',
    socialRole: '',
    personaType: 'debutant',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof AthleteFormValues>(
    key: K,
    value: AthleteFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/onboarding/step-1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const data: any = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        setError(
          data?.message ??
            data?.error ??
            "Erreur lors de l'enregistrement de ton profil.",
        )
        return
      }

      const next: string =
        typeof data.next === 'string' ? data.next : '/onboarding/step-2'

      router.push(next)
    } catch (err) {
      console.error('Erreur AthletePersonaForm', err)
      setError(
        "Impossible de contacter le serveur. Vérifie ta connexion et réessaie.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">
          Parle-nous un peu de toi
        </h1>
        <p className="text-sm text-slate-500">
          Ces informations aident les coachs à comprendre ton profil et ton
          contexte.
        </p>
      </header>

      {/* VISIBILITÉ */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-900">
          Visibilité de ton profil
        </label>
        <p className="text-xs text-slate-500">
          Tu pourras rester discret ou te rendre plus visible aux coachs.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            {
              id: 'public',
              label: 'Public',
              desc: 'Les coachs peuvent voir ton profil dans le hub',
            },
            {
              id: 'semi_public',
              label: 'Semi-public',
              desc: 'Uniquement les coachs avec qui tu échanges',
            },
            {
              id: 'private',
              label: 'Privé',
              desc: 'Ton profil n’est pas listé publiquement',
            },
          ].map((opt) => {
            const selected = values.profileVisibility === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  update(
                    'profileVisibility',
                    opt.id as AthleteFormValues['profileVisibility'],
                  )
                }
                className={`flex flex-col rounded-2xl border px-3 py-2 text-left text-xs transition ${
                  selected
                    ? 'border-slate-900 bg-slate-900 text-slate-50'
                    : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300'
                }`}
              >
                <span className="text-[13px] font-semibold">
                  {opt.label}
                </span>
                <span
                  className={
                    selected ? 'text-slate-200' : 'text-slate-500'
                  }
                >
                  {opt.desc}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* RÔLE SOCIAL / IDENTITÉ */}
      <div className="space-y-2">
        <label
          htmlFor="socialRole"
          className="text-sm font-medium text-slate-900"
        >
          Comment te décrirais-tu en une phrase ?
        </label>
        <p className="text-xs text-slate-500">
          Par ex. &laquo; Coureur amateur qui prépare son premier semi
          &raquo; ou &laquo; Athlète confirmé en musculation &raquo;.
        </p>
        <input
          id="socialRole"
          type="text"
          required
          value={values.socialRole}
          onChange={(e) => update('socialRole', e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:bg-white"
          placeholder="Coureur amateur qui prépare son premier semi-marathon"
        />
      </div>

      {/* TYPE D'ATHLÈTE */}
      <div className="space-y-2">
        <label
          htmlFor="personaType"
          className="text-sm font-medium text-slate-900"
        >
          Quel type d’athlète es-tu ?
        </label>
        <select
          id="personaType"
          value={values.personaType}
          onChange={(e) =>
            update('personaType', e.target.value as AthleteFormValues['personaType'])
          }
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
        >
          <option value="debutant">Débutant</option>
          <option value="intermediaire">Intermédiaire</option>
          <option value="avance">Avancé</option>
          <option value="haut_niveau">Haut niveau / compétiteur</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 pt-2">
        <p className="text-xs text-slate-500">
          Ton objectif sportif détaillé sera précisé dans l’étape suivante.
        </p>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {loading ? 'Enregistrement…' : 'Continuer'}
        </button>
      </div>
    </form>
  )
}
