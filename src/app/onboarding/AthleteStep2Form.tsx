// src/app/onboarding/AthleteStep2Form.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type AthleteStep2FormValues = {
  priceRange: string
  disciplines: string[]
  coachPersonality: string[]
  followupDuration: string
  locationPreference: string
}

type AthleteStep2FormProps = {
  initialPriceRange?: string | null
  initialDisciplines?: string[]
  initialCoachPersonality?: string[]
  initialFollowupDuration?: string | null
  initialLocationPreference?: string | null
}

const PRICE_RANGES = [
  "Moins de 50€/mois",
  "50–100€/mois",
  "100–200€/mois",
  "Plus de 200€/mois",
  "Peu importe, priorité à la qualité",
]

const DISCIPLINES = [
  "Musculation / Fitness",
  "Course à pied",
  "Sports collectifs",
  "Sports de combat",
  "Endurance / triathlon",
  "Reathlétisation / post-blessure",
]

const PERSONALITY_TAGS = [
  "Bienveillant / pédagogue",
  "Très cadré / exigeant",
  "Orienté performance",
  "Orienté santé / bien-être",
  "Très disponible / réactif",
]

const DURATIONS = [
  "Moins de 3 mois",
  "3–6 mois",
  "6–12 mois",
  "Plus de 12 mois",
  "Je ne sais pas encore",
]

const LOCATION_PREFS = [
  "Peu importe (full distanciel)",
  "Plutôt proche de chez moi",
  "Même pays uniquement",
]

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1.5 text-xs sm:text-sm font-semibold transition",
        selected
          ? "bg-white text-slate-950"
          : "border border-white/15 bg-white/5 text-white hover:bg-white/10",
      ].join(" ")}
    >
      {label}
    </button>
  )
}

export default function AthleteStep2Form({
  initialPriceRange,
  initialDisciplines,
  initialCoachPersonality,
  initialFollowupDuration,
  initialLocationPreference,
}: AthleteStep2FormProps) {
  const router = useRouter()

  const [form, setForm] = useState<AthleteStep2FormValues>({
    priceRange: initialPriceRange ?? "",
    disciplines: Array.isArray(initialDisciplines) ? initialDisciplines : [],
    coachPersonality: Array.isArray(initialCoachPersonality) ? initialCoachPersonality : [],
    followupDuration: initialFollowupDuration ?? "",
    locationPreference: initialLocationPreference ?? "Même pays uniquement",
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>("")

  // Prefill (fallback API) : ne remplace pas si déjà défini par les props (server DB)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch("/api/onboarding/step-2", { cache: "no-store" })
        const j = await r.json().catch(() => null)
        if (!r.ok || !j?.ok) return
        const a = j?.answers ?? {}
        if (cancelled) return

        setForm((prev) => ({
          ...prev,
          priceRange:
            prev.priceRange ||
            (typeof a.priceRange === "string" ? a.priceRange : prev.priceRange),
          disciplines:
            prev.disciplines.length > 0
              ? prev.disciplines
              : Array.isArray(a.disciplines)
              ? a.disciplines.map(String)
              : prev.disciplines,
          coachPersonality:
            prev.coachPersonality.length > 0
              ? prev.coachPersonality
              : Array.isArray(a.coachPersonality)
              ? a.coachPersonality.map(String)
              : prev.coachPersonality,
          followupDuration:
            prev.followupDuration ||
            (typeof a.followupDuration === "string" ? a.followupDuration : prev.followupDuration),
          locationPreference:
            prev.locationPreference ||
            (typeof a.locationPreference === "string"
              ? a.locationPreference
              : prev.locationPreference),
        }))
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function toggle(key: "disciplines" | "coachPersonality", value: string) {
    setForm((prev) => {
      const arr = prev[key]
      const exists = arr.includes(value)
      const nextArr = exists ? arr.filter((x) => x !== value) : [...arr, value]
      return { ...prev, [key]: nextArr } as AthleteStep2FormValues
    })
  }

  const canSubmit = form.priceRange !== "" && form.disciplines.length > 0 && !submitting

  async function onSubmit() {
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/onboarding/step-2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(form), // ✅ payload direct
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok !== true) {
        setError(data?.message || "Impossible d’enregistrer. Réessaie.")
        return
      }
      const next = typeof data?.next === "string" ? data.next : "/onboarding/step-3"
      router.push(next)
      router.refresh()
    } catch {
      setError("Erreur réseau. Réessaie.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_70px_rgba(0,0,0,0.25)] backdrop-blur">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
          Onboarding athlète — Étape 2
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Trouvons ton coach</h1>
        <p className="mt-2 text-sm text-white/60">
          On s’en sert pour mieux te recommander (budget, disciplines, style).
        </p>
      </header>

      {/* Budget */}
      <div className="mt-5 space-y-2">
        <div className="text-xs font-semibold text-white/70">Budget approximatif</div>
        <div className="flex flex-wrap gap-2">
          {PRICE_RANGES.map((p) => (
            <Chip
              key={p}
              label={p}
              selected={form.priceRange === p}
              onClick={() => setForm((prev) => ({ ...prev, priceRange: p }))}
            />
          ))}
        </div>
      </div>

      {/* Disciplines */}
      <div className="mt-6 space-y-2">
        <div className="text-xs font-semibold text-white/70">Disciplines recherchées</div>
        <div className="flex flex-wrap gap-2">
          {DISCIPLINES.map((d) => (
            <Chip
              key={d}
              label={d}
              selected={form.disciplines.includes(d)}
              onClick={() => toggle("disciplines", d)}
            />
          ))}
        </div>
      </div>

      {/* Personnalité */}
      <div className="mt-6 space-y-2">
        <div className="text-xs font-semibold text-white/70">Style de coach</div>
        <div className="flex flex-wrap gap-2">
          {PERSONALITY_TAGS.map((t) => (
            <Chip
              key={t}
              label={t}
              selected={form.coachPersonality.includes(t)}
              onClick={() => toggle("coachPersonality", t)}
            />
          ))}
        </div>
      </div>

      {/* Durée */}
      <div className="mt-6 space-y-2">
        <div className="text-xs font-semibold text-white/70">Durée de suivi</div>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <Chip
              key={d}
              label={d}
              selected={form.followupDuration === d}
              onClick={() => setForm((prev) => ({ ...prev, followupDuration: d }))}
            />
          ))}
        </div>
      </div>

      {/* Localisation */}
      <div className="mt-6 space-y-2">
        <div className="text-xs font-semibold text-white/70">Préférence géographique</div>
        <select
          value={form.locationPreference}
          onChange={(e) => setForm((prev) => ({ ...prev, locationPreference: e.target.value }))}
          className="w-full rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
        >
          {LOCATION_PREFS.map((l) => (
            <option key={l} value={l} className="bg-slate-950">
              {l}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmit}
        className="mt-7 w-full rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Enregistrement…" : "Continuer"}
      </button>
    </div>
  )
}
