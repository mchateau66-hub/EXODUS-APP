// src/app/onboarding/ui/OnboardingStep3Client.tsx
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { COACH_KEYWORDS } from "@/data/coachKeywords"
import AvatarUploader from "@/components/profile/AvatarUploader"

type Role = "coach" | "athlete" | "admin"

function norm(s: string) {
  return s.trim().toLowerCase()
}

function uniqCI(list: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of list) {
    const k = norm(s)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(s)
  }
  return out
}

function sanitizeCsvValue(s: string, max = 60) {
  return s.replace(/,/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
}

function Chip({
  label,
  selected,
  onClick,
  onRemove,
}: {
  label: string
  selected: boolean
  onClick?: () => void
  onRemove?: () => void
}) {
  return (
    <div
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition",
        selected
          ? "bg-white text-slate-950"
          : "border border-white/15 bg-white/5 text-white hover:bg-white/10",
      ].join(" ")}
    >
      <button type="button" onClick={onClick} className="leading-none">
        {label}
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Retirer ${label}`}
          className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold text-slate-950 hover:bg-black/20"
        >
          ×
        </button>
      ) : null}
    </div>
  )
}

type Profile = {
  name: string
  age: number | null
  country: string
  language: string
  avatarUrl: string
  bio: string
  keywords: string[]
  theme: "light" | "dark"
}

const EMPTY: Profile = {
  name: "",
  age: null,
  country: "",
  language: "",
  avatarUrl: "",
  bio: "",
  keywords: [],
  theme: "light",
}

export default function OnboardingStep3Client({ role }: { role: Role }) {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>("")

  const [profile, setProfile] = useState<Profile>(EMPTY)

  const [kwQuery, setKwQuery] = useState("")
  const [kwOpen, setKwOpen] = useState(false)
  const [kwActiveIndex, setKwActiveIndex] = useState(0)
  const kwBoxRef = useRef<HTMLDivElement | null>(null)
  const kwInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError("")
      try {
        const r = await fetch("/api/onboarding/step-3", { cache: "no-store" })
        const j = await r.json().catch(() => null)
        if (!r.ok || !j?.ok) throw new Error("load_failed")

        const p = j.profile ?? {}
        const next: Profile = {
          name: typeof p.name === "string" ? p.name : "",
          age: typeof p.age === "number" ? p.age : null,
          country: typeof p.country === "string" ? p.country : "",
          language: typeof p.language === "string" ? p.language : "",
          avatarUrl: typeof p.avatarUrl === "string" ? p.avatarUrl : "",
          bio: typeof p.bio === "string" ? p.bio : "",
          keywords: Array.isArray(p.keywords) ? p.keywords.map(String) : [],
          theme: p.theme === "dark" ? "dark" : "light",
        }

        if (!cancelled) setProfile(next)
      } catch {
        if (!cancelled) setError("Impossible de charger le profil. Réessaie.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (kwBoxRef.current && !kwBoxRef.current.contains(target)) setKwOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  const keywordSuggestions = useMemo(() => {
    const q = norm(kwQuery)
    const selected = new Set(profile.keywords.map(norm))
    const base = COACH_KEYWORDS
    const filtered = q ? base.filter((k) => norm(k).includes(q)) : base
    return filtered.filter((k) => !selected.has(norm(k))).slice(0, 10)
  }, [kwQuery, profile.keywords])

  function addKeywordFromUI(value: string) {
    const v = sanitizeCsvValue(value, 60)
    if (!v) return

    if (role === "coach") {
      const canonical = COACH_KEYWORDS.find((k) => norm(k) === norm(v))
      if (!canonical) return
      setProfile((prev) => ({
        ...prev,
        keywords: uniqCI([...prev.keywords, canonical]).slice(0, 25),
      }))
    } else {
      setProfile((prev) => ({
        ...prev,
        keywords: uniqCI([...prev.keywords, v]).slice(0, 25),
      }))
    }

    setKwQuery("")
    setKwActiveIndex(0)
    setKwOpen(false)
    kwInputRef.current?.focus()
  }

  function removeKeyword(value: string) {
    setProfile((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((k) => norm(k) !== norm(value)),
    }))
  }

  async function onSave() {
    setSaving(true)
    setError("")
    try {
      const payload = {
        name: profile.name,
        age: profile.age,
        country: profile.country,
        language: profile.language,
        avatarUrl: profile.avatarUrl, // ✅ désormais alimenté par l’uploader
        bio: profile.bio,
        keywords: profile.keywords,
        theme: profile.theme,
      }

      const r = await fetch("/api/onboarding/step-3", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      })

      const j = await r.json().catch(() => ({}))
      if (!r.ok || j?.ok !== true) {
        setError(j?.message || j?.error || "Impossible d’enregistrer. Réessaie.")
        return
      }

      const next = typeof j?.next === "string" ? j.next : "/hub"
      router.push(next)
      router.refresh()
    } catch {
      setError("Erreur réseau. Réessaie.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_70px_rgba(0,0,0,0.25)] backdrop-blur">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
          Onboarding — Étape 3
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Ton profil public</h1>
        <p className="mt-2 text-sm text-white/60">
          {role === "coach"
            ? "Ces infos aident les athlètes à te comprendre rapidement."
            : "Ces infos aident à personnaliser ton expérience."}
        </p>
      </header>

      {loading ? (
        <div className="text-sm text-white/60">Chargement…</div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-white/70" htmlFor="name">
                Nom / pseudo
              </label>
              <input
                id="name"
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                placeholder="Ex: Alex Dupont"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium text-white/70" htmlFor="age">
                Âge (optionnel)
              </label>
              <input
                id="age"
                type="number"
                min={0}
                max={120}
                value={profile.age ?? ""}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    age: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className="w-full rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-white/70" htmlFor="country">
                Pays
              </label>
              <input
                id="country"
                value={profile.country}
                onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))}
                className="w-full rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                placeholder="Ex: France"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium text-white/70" htmlFor="language">
                Langue
              </label>
              <input
                id="language"
                value={profile.language}
                onChange={(e) => setProfile((p) => ({ ...p, language: e.target.value }))}
                className="w-full rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                placeholder="Ex: FR"
              />
            </div>
          </div>

          {/* ✅ Avatar uploader (remplace l’input URL) */}
          <div className="grid gap-2">
            <label className="text-xs font-medium text-white/70">
              Photo de profil
            </label>

            <div className="rounded-2xl border border-white/15 bg-black/20 p-3">
            <AvatarUploader
  value={profile.avatarUrl}
  onChange={(url) => setProfile((p) => ({ ...p, avatarUrl: url }))}
  label="Avatar"
/>  
              <p className="mt-2 text-[11px] text-white/45">
                Formats: JPG/PNG/WEBP — max 3MB.
              </p>
            </div>
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium text-white/70" htmlFor="bio">
              Bio
            </label>
            <textarea
              id="bio"
              value={profile.bio}
              onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
              rows={5}
              className="w-full rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
            />
          </div>

          <div className="mt-2" ref={kwBoxRef}>
            <div className="text-xs font-semibold text-white/70">Mots-clés (max 25)</div>

            {profile.keywords.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.keywords.map((k) => (
                  <Chip key={k} label={k} selected={true} onRemove={() => removeKeyword(k)} />
                ))}
              </div>
            ) : (
              <div className="mt-2 text-xs text-white/55">
                {role === "coach" ? "Choisis des mots-clés (liste)." : "Optionnel."}
              </div>
            )}

            <div className="relative mt-3">
              <input
                ref={kwInputRef}
                value={kwQuery}
                onChange={(e) => {
                  setKwQuery(e.target.value)
                  setKwOpen(true)
                  setKwActiveIndex(0)
                }}
                onFocus={() => {
                  setKwOpen(true)
                  setKwActiveIndex(0)
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault()
                    setKwOpen(true)
                    setKwActiveIndex((i) => Math.min(i + 1, keywordSuggestions.length - 1))
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault()
                    setKwActiveIndex((i) => Math.max(i - 1, 0))
                  } else if (e.key === "Enter") {
                    e.preventDefault()
                    if (keywordSuggestions.length > 0) {
                      addKeywordFromUI(keywordSuggestions[kwActiveIndex] ?? keywordSuggestions[0])
                    } else if (role !== "coach") {
                      addKeywordFromUI(kwQuery)
                    }
                  } else if (e.key === "Escape") {
                    setKwOpen(false)
                  }
                }}
                placeholder={role === "coach" ? "Chercher un mot-clé…" : "Ajouter un mot-clé…"}
                className="w-full rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
              />

              {kwOpen ? (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-[0_25px_70px_rgba(0,0,0,0.6)] backdrop-blur">
                  {keywordSuggestions.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-white/60">
                      {role === "coach"
                        ? "Aucun résultat (liste uniquement)."
                        : "Aucun résultat (Entrée = ajouter)."}
                    </div>
                  ) : (
                    keywordSuggestions.map((k, idx) => {
                      const active = idx === kwActiveIndex
                      return (
                        <button
                          key={k}
                          type="button"
                          onMouseEnter={() => setKwActiveIndex(idx)}
                          onClick={() => addKeywordFromUI(k)}
                          className={[
                            "w-full px-3 py-2 text-left text-sm",
                            active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5",
                          ].join(" ")}
                        >
                          {k}
                        </button>
                      )
                    })
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="mt-2 w-full rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white/90 disabled:opacity-60"
          >
            {saving ? "Enregistrement…" : "Finaliser et aller au hub"}
          </button>
        </div>
      )}
    </div>
  )
}
