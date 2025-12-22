// src/app/onboarding/CoachPersonaForm.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type CoachFormValues = {
  profileVisibility: 'public' | 'semi_public' | 'private'
  socialRole: string
  personaType: string
  shortPublicTitle: string
}

export default function CoachPersonaForm() {
  const router = useRouter()
  const [values, setValues] = useState<CoachFormValues>({
    profileVisibility: 'public',
    socialRole: '',
    personaType: 'coach_expert',
    shortPublicTitle: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof CoachFormValues>(
    key: K,
    value: CoachFormValues[K],
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
            "Erreur lors de l'enregistrement de ton profil coach.",
        )
        return
      }

      const next: string =
        typeof data.next === 'string' ? data.next : '/onboarding/step-2'

      router.push(next)
    } catch (err) {
      console.error('Erreur CoachPersonaForm', err)
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
          Configure ton profil de coach
        </h1>
        <p className="text-sm text-slate-500">
          Ces informations servent à présenter ton rôle et ta spécialité aux
          athlètes qui te découvrent.
        </p>
      </header>

      {/* VISIBILITÉ */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-900">
          Visibilité de ton profil
        </label>
        <p className="text-xs text-slate-500">
          Tu pourras modifier ce réglage plus tard dans ton compte.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            {
              id: 'public',
              label: 'Public',
              desc: 'Visible dans le hub de coachs',
            },
            {
              id: 'semi_public',
              label: 'Semi-public',
              desc: 'Visible seulement pour les athlètes connectés',
            },
            {
              id: 'private',
              label: 'Privé',
              desc: 'Uniquement accessibles via un lien direct',
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
                    opt.id as CoachFormValues['profileVisibility'],
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

      {/* RÔLE SOCIAL */}
      <div className="space-y-2">
        <label
          htmlFor="socialRole"
          className="text-sm font-medium text-slate-900"
        >
          Comment veux-tu te présenter ?
        </label>
        <p className="text-xs text-slate-500">
          Par exemple : &laquo; Coach diplômé en préparation trail &raquo;,
          &laquo; Ancien athlète de haut niveau &raquo;…
        </p>
        <input
          id="socialRole"
          type="text"
          required
          value={values.socialRole}
          onChange={(e) => update('socialRole', e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:bg-white"
          placeholder="Coach certifié en préparation course à pied"
        />
      </div>

      {/* TYPE DE PERSONA */}
      <div className="space-y-2">
        <label
          htmlFor="personaType"
          className="text-sm font-medium text-slate-900"
        >
          Type de coach
        </label>
        <select
          id="personaType"
          value={values.personaType}
          onChange={(e) =>
            update('personaType', e.target.value as CoachFormValues['personaType'])
          }
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
        >
          <option value="coach_expert">Coach expert</option>
          <option value="coach_pedagogue">Coach pédagogue</option>
          <option value="coach_motivateur">Coach motivateur</option>
          <option value="coach_bienveillant">Coach bienveillant</option>
        </select>
      </div>

      {/* TITRE COURT PUBLIC */}
      <div className="space-y-2">
        <label
          htmlFor="shortPublicTitle"
          className="text-sm font-medium text-slate-900"
        >
          Titre court affiché aux athlètes
        </label>
        <p className="text-xs text-slate-500">
          Ce texte sera affiché sous ton nom dans le hub et la messagerie.
        </p>
        <input
          id="shortPublicTitle"
          type="text"
          required
          maxLength={80}
          value={values.shortPublicTitle}
          onChange={(e) => update('shortPublicTitle', e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:bg-white"
          placeholder="Spécialiste préparation course & endurance"
        />
        <p className="text-right text-[11px] text-slate-400">
          {values.shortPublicTitle.length}/80
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 pt-2">
        <p className="text-xs text-slate-500">
          Tu pourras compléter tes infos (photo, bio, langues…) à l’étape
          suivante.
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
