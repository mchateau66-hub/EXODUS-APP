// src/app/onboarding/ProfileStep3Form.tsx
'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  initialName: string
  initialAge: number | null
  initialCountry: string
  initialLanguage: string
  initialTheme: string
  initialBio: string
  initialKeywords: string[]
  role: 'athlete' | 'coach'
}

const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'Anglais' },
  { code: 'es', label: 'Espagnol' },
]

const THEMES = [
  { value: 'light', label: 'Fond clair (noir sur blanc)' },
  { value: 'dark', label: 'Fond sombre (blanc sur noir)' },
]

export default function ProfileStep3Form({
  initialName,
  initialAge,
  initialCountry,
  initialLanguage,
  initialTheme,
  initialBio,
  initialKeywords,
  role,
}: Props) {
  const router = useRouter()

  const [name, setName] = useState(initialName)
  const [age, setAge] = useState<string>(
    initialAge != null ? String(initialAge) : '',
  )
  const [country, setCountry] = useState(initialCountry)
  const [language, setLanguage] = useState(
    initialLanguage || 'fr',
  )
  const [theme, setTheme] = useState<'light' | 'dark'>(
    initialTheme === 'dark' ? 'dark' : 'light',
  )
  const [bio, setBio] = useState(initialBio)
  const [keywordInput, setKeywordInput] = useState('')
  const [keywords, setKeywords] = useState<string[]>(initialKeywords)

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addKeyword() {
    const value = keywordInput.trim()
    if (!value) return
    if (keywords.includes(value)) {
      setKeywordInput('')
      return
    }
    setKeywords((prev) =>
      [...prev, value].slice(0, 15),
    )
    setKeywordInput('')
  }

  function removeKeyword(tag: string) {
    setKeywords((prev) => prev.filter((k) => k !== tag))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitted(false)
    setError(null)

    const ageNumber =
      age.trim() === '' ? null : Number.parseInt(age, 10)

    const payload = {
      name: name.trim() || undefined,
      age: Number.isNaN(ageNumber) ? undefined : ageNumber,
      country: country.trim() || undefined,
      language: language || undefined,
      theme,
      bio: bio.trim() || undefined,
      keywords,
    }

    try {
      const res = await fetch('/api/onboarding/step-3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        setError(
          data?.error ??
            'Erreur lors de la sauvegarde du profil.',
        )
        return
      }

      setSubmitted(true)

      // Étape suivante : pour l’instant on considère que l’utilisateur
      // peut partir sur son espace principal.
      if (role === 'coach') {
        router.push('/coach')
      } else {
        router.push('/messages')
      }
    } catch (err) {
      console.error('Erreur onboarding step 3', err)
      setError(
        'Impossible denregistrer ton profil pour le moment. Réessaie dans un instant.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit =
    !submitting &&
    name.trim().length > 0 &&
    language.trim().length > 0

  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Onboarding — Étape 3
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Finalise ton profil
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Ces informations seront visibles par les autres utilisateurs et
          aideront à mieux te comprendre en un coup d’œil.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nom / pseudo */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-800">
            Comment veux-tu être affiché ?
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setSubmitted(false)
            }}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/40"
            placeholder="Ton prénom, pseudo, ou nom complet"
          />
        </div>

        {/* Âge + pays */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-800">
              Ton âge (optionnel)
            </label>
            <input
              type="number"
              min={10}
              max={100}
              value={age}
              onChange={(e) => {
                setAge(e.target.value)
                setSubmitted(false)
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/40"
              placeholder="Ex : 28"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-800">
              Pays
            </label>
            <input
              type="text"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value)
                setSubmitted(false)
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/40"
              placeholder="Ex : France, Belgique, Canada..."
            />
          </div>
        </div>

        {/* Langue + thème */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-800">
              Langue principale
            </label>
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value)
                setSubmitted(false)
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/40"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-800">
              Apparence de l’interface
            </label>
            <div className="flex flex-col gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setTheme(t.value as 'light' | 'dark')
                    setSubmitted(false)
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-sm text-left transition ${
                    theme === t.value
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-800 hover:border-slate-500'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-800">
            Présentation (bio)
          </label>
          <textarea
            value={bio}
            onChange={(e) => {
              setBio(e.target.value)
              setSubmitted(false)
            }}
            rows={4}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/40"
            placeholder={
              role === 'coach'
                ? 'Explique en quelques lignes ta philosophie de coaching, ton expérience, ta façon d’accompagner.'
                : 'Présente-toi rapidement : ton sport, ton vécu, ce que tu recherches dans cet accompagnement.'
            }
          />
        </div>

        {/* Mots-clés */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-800">
            Mots-clés qui te représentent
          </label>
          <p className="text-xs text-slate-500">
            Par exemple : &quot;préparateur physique&quot;, &quot;triathlon&quot;,
            &quot;mindset&quot;, &quot;perte de poids&quot;, &quot;entrepreneur&quot;…
          </p>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addKeyword()
                }
              }}
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/40"
              placeholder="Tape un mot-clé puis appuie sur Entrée"
            />
            <button
              type="button"
              onClick={addKeyword}
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
            >
              Ajouter
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {keywords.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => removeKeyword(tag)}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs"
              >
                <span>{tag}</span>
                <span className="text-slate-400">✕</span>
              </button>
            ))}
            {keywords.length === 0 && (
              <p className="text-xs text-slate-400">
                Aucun mot-clé ajouté pour le moment.
              </p>
            )}
          </div>
        </div>

        {/* Feedback + submit */}
        <div className="space-y-2 pt-2">
          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full inline-flex items-center justify-center rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting
              ? 'Enregistrement…'
              : 'Terminer cette étape'}
          </button>

          {submitted && (
            <p className="text-xs text-emerald-600">
              Profil mis à jour. Tu peux maintenant accéder à ton espace.
            </p>
          )}
        </div>
      </form>
    </>
  )
}
