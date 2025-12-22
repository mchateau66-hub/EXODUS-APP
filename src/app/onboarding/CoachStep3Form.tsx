// src/app/onboarding/step-3/CoachStep3Form.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type CoachStep3Values = {
  name: string
  age: string
  country: string
  language: string
  avatarUrl: string
  bio: string
  keywords: string // "course à pied, trail"
  theme: 'light' | 'dark'
}

export default function CoachStep3Form() {
  const router = useRouter()
  const [values, setValues] = useState<CoachStep3Values>({
    name: '',
    age: '',
    country: '',
    language: 'fr',
    avatarUrl: '',
    bio: '',
    keywords: '',
    theme: 'light',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof CoachStep3Values>(
    key: K,
    value: CoachStep3Values[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const ageNumber =
        values.age.trim().length > 0
          ? Number(values.age)
          : null

      const payload = {
        name: values.name,
        age:
          ageNumber !== null && !Number.isNaN(ageNumber)
            ? ageNumber
            : null,
        country: values.country,
        language: values.language,
        avatarUrl: values.avatarUrl,
        bio: values.bio,
        keywords: values.keywords,
        theme: values.theme,
      }

      const res = await fetch('/api/onboarding/step-3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data: any = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        setError(
          data?.message ??
            data?.error ??
            'Erreur lors de la sauvegarde de ton profil.',
        )
        return
      }

      const next: string =
        typeof data.next === 'string' ? data.next : '/coach'

      router.push(next)
    } catch (err) {
      console.error('Erreur CoachStep3Form', err)
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
          Finalise ton profil coach
        </h1>
        <p className="text-sm text-slate-500">
          Ces informations seront visibles par les athlètes dans le hub et
          la messagerie.
        </p>
      </header>

      {/* NOM / PRÉNOM */}
      <div className="space-y-2">
        <label
          htmlFor="name"
          className="text-sm font-medium text-slate-900"
        >
          Nom affiché
        </label>
        <input
          id="name"
          type="text"
          required
          value={values.name}
          onChange={(e) => update('name', e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:bg-white"
          placeholder="Ex : Marie Dupont"
        />
      </div>

      {/* AGE + LANGUE */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <label
            htmlFor="age"
            className="text-sm font-medium text-slate-900"
          >
            Âge (optionnel)
          </label>
          <input
            id="age"
            type="number"
            min={18}
            max={90}
            value={values.age}
            onChange={(e) => update('age', e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
            placeholder="Ex : 32"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="language"
            className="text-sm font-medium text-slate-900"
          >
            Langue principale
          </label>
          <select
            id="language"
            value={values.language}
            onChange={(e) => update('language', e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
          >
            <option value="fr">Français</option>
            <option value="en">Anglais</option>
            <option value="es">Espagnol</option>
            <option value="de">Allemand</option>
            <option value="it">Italien</option>
            <option value="other">Autre</option>
          </select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="country"
            className="text-sm font-medium text-slate-900"
          >
            Pays
          </label>
          <input
            id="country"
            type="text"
            value={values.country}
            onChange={(e) => update('country', e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:bg-white"
            placeholder="Ex : France"
          />
        </div>
      </div>

      {/* AVATAR URL */}
      <div className="space-y-2">
        <label
          htmlFor="avatarUrl"
          className="text-sm font-medium text-slate-900"
        >
          Photo de profil (URL, optionnel)
        </label>
        <input
          id="avatarUrl"
          type="url"
          value={values.avatarUrl}
          onChange={(e) => update('avatarUrl', e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:bg-white"
          placeholder="https://…"
        />
      </div>

      {/* BIO */}
      <div className="space-y-2">
        <label
          htmlFor="bio"
          className="text-sm font-medium text-slate-900"
        >
          Bio courte
        </label>
        <textarea
          id="bio"
          rows={3}
          value={values.bio}
          onChange={(e) => update('bio', e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:bg-white"
          placeholder="Parle de ton expérience, ta philosophie de coaching, etc."
        />
      </div>

      {/* MOTS-CLÉS */}
      <div className="space-y-2">
        <label
          htmlFor="keywords"
          className="text-sm font-medium text-slate-900"
        >
          Mots-clés (séparés par des virgules)
        </label>
        <input
          id="keywords"
          type="text"
          value={values.keywords}
          onChange={(e) => update('keywords', e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:bg-white"
          placeholder="course à pied, trail, préparation marathon..."
        />
      </div>

      {/* THÈME */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-900">
          Thème de l’interface
        </p>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => update('theme', 'light')}
            className={`flex-1 rounded-2xl border px-3 py-2 ${
              values.theme === 'light'
                ? 'border-slate-900 bg-slate-900 text-slate-50'
                : 'border-slate-200 bg-slate-50 text-slate-900'
            }`}
          >
            Clair
          </button>
          <button
            type="button"
            onClick={() => update('theme', 'dark')}
            className={`flex-1 rounded-2xl border px-3 py-2 ${
              values.theme === 'dark'
                ? 'border-slate-900 bg-slate-900 text-slate-50'
                : 'border-slate-200 bg-slate-50 text-slate-900'
            }`}
          >
            Sombre
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 pt-2">
        <p className="text-xs text-slate-500">
          Tu pourras modifier ces informations dans ton espace compte plus
          tard.
        </p>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {loading ? 'Enregistrement…' : 'Terminer'}
        </button>
      </div>
    </form>
  )
}
