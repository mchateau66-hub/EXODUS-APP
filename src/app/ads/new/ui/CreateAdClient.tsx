"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

export default function CreateAdClient() {
  const router = useRouter()

  const [title, setTitle] = useState("")
  const [goal, setGoal] = useState("")
  const [sport, setSport] = useState("")
  const [keywords, setKeywords] = useState("")
  const [country, setCountry] = useState("FR")
  const [language, setLanguage] = useState("fr")
  const [durationDays, setDurationDays] = useState(14)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canSubmit = useMemo(() => title.trim().length >= 3 && !loading, [title, loading])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/ads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          goal,
          sport,
          keywords,
          country,
          language,
          durationDays,
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || "Impossible de créer l’annonce.")
      }

      router.push("/hub")
      router.refresh()
    } catch (err: any) {
      setError(err?.message || "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
      <div>
        <label className="text-sm font-medium">Titre</label>
        <input
          className="mt-1 w-full rounded-xl border px-3 py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Objectif perte de poids – besoin d’un coach motivant"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Objectif (détails)</label>
        <textarea
          className="mt-1 w-full min-h-[110px] rounded-xl border px-3 py-2"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Ton objectif, ton niveau, ton contexte, ce que tu attends…"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Sport</label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            placeholder="Ex: Musculation / Running / Crossfit"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Mots-clés (séparés par virgules)</label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Ex: hypertrophie, perte de poids, mobilité…"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="text-sm font-medium">Pays</label>
          <input className="mt-1 w-full rounded-xl border px-3 py-2" value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Langue</label>
          <input className="mt-1 w-full rounded-xl border px-3 py-2" value={language} onChange={(e) => setLanguage(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Durée (jours)</label>
          <input
            type="number"
            min={1}
            max={60}
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
          />
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Création..." : "Publier"}
        </button>
      </div>
    </form>
  )
}
