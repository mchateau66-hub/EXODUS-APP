"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { COACH_KEYWORDS } from "@/data/coachKeywords"

type SportItem = { label: string; count?: number }

type HighestDiploma =
  | "none"
  | "bpjeps"
  | "staps_licence"
  | "staps_master"
  | "federation"
  | "other"

type Props = {
  initialMainSports?: string[]
  initialKeywords?: string[]
  initialYearsExperience?: number
  initialHighestDiploma?: HighestDiploma
  initialCertifications?: string
  initialHasClubExperience?: boolean
  initialRemoteCoaching?: boolean
  initialInPersonCoaching?: boolean
}

function uniq(list: string[]) {
  return Array.from(new Set(list))
}

function norm(s: string) {
  return s.trim().toLowerCase()
}

function sanitizeCsvValue(s: string) {
  return s.replace(/,/g, " ").replace(/\s+/g, " ").trim().slice(0, 60)
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
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
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className="leading-none"
      >
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

const MAX_SELECTED_SPORTS = 5
const MAX_SELECTED_KEYWORDS = 20

const POPULAR_KEYWORDS = [
  "Perte de poids",
  "Prise de masse",
  "Musculation",
  "Prévention blessures",
  "Mobilité",
  "Nutrition",
  "Course à pied",
  "Réathlétisation",
]

const FALLBACK_SPORTS = [
  "Musculation",
  "Fitness",
  "CrossFit",
  "Course à pied",
  "Trail",
  "Cyclisme",
  "Natation",
  "Triathlon",
  "Yoga",
  "Pilates",
  "Mobilité",
  "Réathlétisation",
  "Préparation physique",
  "Boxe",
  "MMA",
  "Football",
  "Basket-ball",
  "Tennis",
  "Padel",
  "Escalade",
]

export default function CoachOnboardingStep2Client({
  initialMainSports = [],
  initialKeywords = [],
  initialYearsExperience = 0,
  initialHighestDiploma = "none",
  initialCertifications = "",
  initialHasClubExperience = false,
  initialRemoteCoaching = true,
  initialInPersonCoaching = false,
}: Props) {
  const router = useRouter()

  // Sports
  const [sportList, setSportList] = useState<string[]>(
    uniq(initialMainSports).slice(0, MAX_SELECTED_SPORTS),
  )
  const [sportQuery, setSportQuery] = useState("")
  const debouncedSportQuery = useDebouncedValue(sportQuery, 160)
  const [sportOpen, setSportOpen] = useState(false)
  const [sportActiveIndex, setSportActiveIndex] = useState(0)
  const [sportSuggestions, setSportSuggestions] = useState<string[]>([])
  const [popularSports, setPopularSports] = useState<string[]>(
    FALLBACK_SPORTS.slice(0, 12),
  )
  const sportBoxRef = useRef<HTMLDivElement | null>(null)
  const sportInputRef = useRef<HTMLInputElement | null>(null)

  // Keywords
  const [keywordList, setKeywordList] = useState<string[]>(
    uniq(initialKeywords).slice(0, MAX_SELECTED_KEYWORDS),
  )
  const [kwQuery, setKwQuery] = useState("")
  const [kwOpen, setKwOpen] = useState(false)
  const [kwActiveIndex, setKwActiveIndex] = useState(0)
  const kwBoxRef = useRef<HTMLDivElement | null>(null)
  const kwInputRef = useRef<HTMLInputElement | null>(null)

  // Qualifs
  const [yearsExperience, setYearsExperience] = useState<number>(initialYearsExperience)
  const [highestDiploma, setHighestDiploma] = useState<HighestDiploma>(initialHighestDiploma)
  const [certifications, setCertifications] = useState<string>(initialCertifications)
  const [hasClubExperience, setHasClubExperience] = useState<boolean>(initialHasClubExperience)
  const [remoteCoaching, setRemoteCoaching] = useState<boolean>(initialRemoteCoaching)
  const [inPersonCoaching, setInPersonCoaching] = useState<boolean>(initialInPersonCoaching)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>("")

  // popular sports
  useEffect(() => {
    let cancelled = false
    async function loadPopular() {
      try {
        const res = await fetch(`/api/sports?limit=12`, { cache: "no-store" })
        if (!res.ok) throw new Error("not ok")
        const data = (await res.json()) as { sports?: SportItem[] }
        const list = (data.sports ?? []).map((x) => x.label).filter(Boolean)
        if (!cancelled && list.length) setPopularSports(list.slice(0, 12))
      } catch {
        // fallback ok
      }
    }
    loadPopular()
    return () => {
      cancelled = true
    }
  }, [])

  // sports suggestions
  useEffect(() => {
    let cancelled = false
    async function loadSuggestions() {
      const q = debouncedSportQuery.trim()
      const selected = new Set(sportList.map(norm))

      if (!q) {
        const base = popularSports.filter((s) => !selected.has(norm(s)))
        if (!cancelled) setSportSuggestions(base.slice(0, 10))
        return
      }

      try {
        const res = await fetch(
          `/api/sports?q=${encodeURIComponent(q)}&limit=10`,
          { cache: "no-store" },
        )
        if (!res.ok) throw new Error("not ok")
        const data = (await res.json()) as { sports?: SportItem[] }
        const list = (data.sports ?? []).map((x) => x.label).filter(Boolean)
        const filtered = list.filter((s) => !selected.has(norm(s)))
        if (!cancelled) setSportSuggestions(filtered.slice(0, 10))
      } catch {
        const qn = norm(q)
        const fallback = FALLBACK_SPORTS.filter(
          (s) => norm(s).includes(qn) && !selected.has(norm(s)),
        ).slice(0, 10)
        if (!cancelled) setSportSuggestions(fallback)
      }
    }

    loadSuggestions()
    return () => {
      cancelled = true
    }
  }, [debouncedSportQuery, sportList, popularSports])

  const addSport = useCallback(
    (value: string) => {
      const v = sanitizeCsvValue(value)
      if (!v) return
      if (sportList.map(norm).includes(norm(v))) return
      if (sportList.length >= MAX_SELECTED_SPORTS) return

      setSportList(uniq([...sportList, v]).slice(0, MAX_SELECTED_SPORTS))
      setSportQuery("")
      setSportActiveIndex(0)
      setSportOpen(false)
      sportInputRef.current?.focus()
    },
    [sportList],
  )

  const removeSport = useCallback(
    (value: string) => setSportList((prev) => prev.filter((x) => x !== value)),
    [],
  )

  const availableKeywords = useMemo(() => {
    const selected = new Set(keywordList.map(norm))
    return COACH_KEYWORDS.filter((k) => !selected.has(norm(k)))
  }, [keywordList])

  const kwSuggestions = useMemo(() => {
    const qn = norm(kwQuery)
    const base = availableKeywords
    const filtered = qn ? base.filter((k) => norm(k).includes(qn)) : base
    return filtered.slice(0, 10)
  }, [kwQuery, availableKeywords])

  const addKeyword = useCallback(
    (value: string) => {
      const v = sanitizeCsvValue(value)

      const canonical = COACH_KEYWORDS.find((k) => norm(k) === norm(v))
      if (!canonical) return
      if (keywordList.map(norm).includes(norm(canonical))) return
      if (keywordList.length >= MAX_SELECTED_KEYWORDS) return

      setKeywordList(uniq([...keywordList, canonical]).slice(0, MAX_SELECTED_KEYWORDS))
      setKwQuery("")
      setKwActiveIndex(0)
      setKwOpen(false)
      kwInputRef.current?.focus()
    },
    [keywordList],
  )

  const removeKeyword = useCallback(
    (value: string) => setKeywordList((prev) => prev.filter((x) => x !== value)),
    [],
  )

  // outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (kwBoxRef.current && !kwBoxRef.current.contains(target)) setKwOpen(false)
      if (sportBoxRef.current && !sportBoxRef.current.contains(target)) setSportOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  async function onSave() {
    setError("")

    if (!sportList.length) {
      setError("Choisis au moins un sport.")
      return
    }

    setSaving(true)
    try {
      const payload = {
        mainSports: sportList,
        keywords: keywordList,
        yearsExperience: Math.max(0, Math.min(50, Number(yearsExperience) || 0)),
        highestDiploma,
        certifications,
        hasClubExperience,
        remoteCoaching,
        inPersonCoaching,
      }

      const res = await fetch("/api/onboarding/step-2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => ({} as any))
      if (!res.ok || json?.ok !== true) {
        setError(json?.message || json?.error || "Impossible d’enregistrer. Réessaie.")
        return
      }

      const next = typeof json?.next === "string" ? json.next : "/onboarding/step-3"
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
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Étape 2 — Sports & mots-clés</h2>
        <div className="text-xs text-white/55">
          {sportList.length}/{MAX_SELECTED_SPORTS} sports • {keywordList.length}/{MAX_SELECTED_KEYWORDS} keywords
        </div>
      </div>

      {/* Sports */}
      <div className="mt-6" ref={sportBoxRef}>
        <div className="text-xs font-semibold text-white/70">Sports principaux</div>

        {sportList.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {sportList.map((s) => (
              <Chip key={s} label={s} selected={true} onRemove={() => removeSport(s)} />
            ))}
          </div>
        ) : (
          <div className="mt-2 text-xs text-white/55">Aucun sport sélectionné.</div>
        )}

        <div className="relative mt-3">
          <input
            ref={sportInputRef}
            value={sportQuery}
            onChange={(e) => {
              setSportQuery(e.target.value)
              setSportOpen(true)
              setSportActiveIndex(0)
            }}
            onFocus={() => {
              setSportOpen(true)
              setSportActiveIndex(0)
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setSportOpen(true)
                setSportActiveIndex((i) => Math.min(i + 1, sportSuggestions.length - 1))
              } else if (e.key === "ArrowUp") {
                e.preventDefault()
                setSportActiveIndex((i) => Math.max(i - 1, 0))
              } else if (e.key === "Enter") {
                e.preventDefault()
                if (sportSuggestions.length > 0) addSport(sportSuggestions[sportActiveIndex] ?? sportSuggestions[0])
                else addSport(sportQuery)
              } else if (e.key === "Escape") {
                setSportOpen(false)
              } else if (e.key === "Backspace" && !sportQuery && sportList.length) {
                removeSport(sportList[sportList.length - 1])
              }
            }}
            placeholder="Ajouter un sport…"
            className="w-full rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />

          {sportOpen ? (
            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-[0_25px_70px_rgba(0,0,0,0.6)] backdrop-blur">
              {sportSuggestions.length === 0 ? (
                <div className="px-3 py-3 text-xs text-white/60">
                  Aucun résultat. Entrée = ajouter “{sanitizeCsvValue(sportQuery) || "…"}”.
                </div>
              ) : (
                sportSuggestions.map((s, idx) => {
                  const active = idx === sportActiveIndex
                  return (
                    <button
                      key={s}
                      type="button"
                      onMouseEnter={() => setSportActiveIndex(idx)}
                      onClick={() => addSport(s)}
                      className={[
                        "w-full px-3 py-2 text-left text-sm",
                        active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5",
                      ].join(" ")}
                    >
                      {s}
                    </button>
                  )
                })
              )}
            </div>
          ) : null}

          <div className="mt-2 text-[11px] text-white/45">
            {sportList.length}/{MAX_SELECTED_SPORTS} sélectionnés
          </div>
        </div>
      </div>

      {/* Keywords */}
      <div className="mt-7" ref={kwBoxRef}>
        <div className="text-xs font-semibold text-white/70">Mots-clés</div>

        {keywordList.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {keywordList.map((k) => (
              <Chip key={k} label={k} selected={true} onRemove={() => removeKeyword(k)} />
            ))}
          </div>
        ) : (
          <div className="mt-2 text-xs text-white/55">Aucun mot-clé sélectionné.</div>
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
            onFocus={() => setKwOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setKwOpen(true)
                setKwActiveIndex((i) => Math.min(i + 1, kwSuggestions.length - 1))
              } else if (e.key === "ArrowUp") {
                e.preventDefault()
                setKwActiveIndex((i) => Math.max(i - 1, 0))
              } else if (e.key === "Enter") {
                e.preventDefault()
                if (kwSuggestions.length > 0) addKeyword(kwSuggestions[kwActiveIndex] ?? kwSuggestions[0])
              } else if (e.key === "Escape") {
                setKwOpen(false)
              } else if (e.key === "Backspace" && !kwQuery && keywordList.length) {
                removeKeyword(keywordList[keywordList.length - 1])
              }
            }}
            placeholder="Ajouter un mot-clé…"
            className="w-full rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />

          {kwOpen ? (
            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-[0_25px_70px_rgba(0,0,0,0.6)] backdrop-blur">
              {kwSuggestions.length === 0 ? (
                <div className="px-3 py-3 text-xs text-white/60">Aucun résultat.</div>
              ) : (
                kwSuggestions.map((k, idx) => {
                  const active = idx === kwActiveIndex
                  return (
                    <button
                      key={k}
                      type="button"
                      onMouseEnter={() => setKwActiveIndex(idx)}
                      onClick={() => addKeyword(k)}
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

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
            Populaires
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {POPULAR_KEYWORDS.map((k) => (
              <Chip
                key={k}
                label={k}
                selected={keywordList.map(norm).includes(norm(k))}
                onClick={() => {
                  const selected = keywordList.map(norm).includes(norm(k))
                  if (selected) {
                    const real = keywordList.find((x) => norm(x) === norm(k)) ?? k
                    removeKeyword(real)
                  } else {
                    addKeyword(k)
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Qualifs */}
      <div className="mt-7 grid gap-3">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-white/70" htmlFor="years">
            Années d’expérience
          </label>
          <input
            id="years"
            type="number"
            min={0}
            max={50}
            value={yearsExperience}
            onChange={(e) => setYearsExperience(Number(e.target.value || 0))}
            className="w-full rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
          />
        </div>

        <div className="grid gap-1">
          <label className="text-xs font-medium text-white/70" htmlFor="diploma">
            Diplôme le plus élevé
          </label>
          <select
            id="diploma"
            value={highestDiploma}
            onChange={(e) => setHighestDiploma(e.target.value as HighestDiploma)}
            className="w-full rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
          >
            <option value="none">Aucun</option>
            <option value="bpjeps">BPJEPS</option>
            <option value="staps_licence">STAPS Licence</option>
            <option value="staps_master">STAPS Master</option>
            <option value="federation">Fédération</option>
            <option value="other">Autre</option>
          </select>
        </div>

        <div className="grid gap-1">
          <label className="text-xs font-medium text-white/70" htmlFor="certs">
            Certifications
          </label>
          <textarea
            id="certs"
            value={certifications}
            onChange={(e) => setCertifications(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
            placeholder="Ex: Diplôme fédéral, certif nutrition..."
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={hasClubExperience}
              onChange={(e) => setHasClubExperience(e.target.checked)}
            />
            Expérience en club
          </label>

          <label className="flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={remoteCoaching}
              onChange={(e) => setRemoteCoaching(e.target.checked)}
            />
            Coaching à distance
          </label>

          <label className="flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={inPersonCoaching}
              onChange={(e) => setInPersonCoaching(e.target.checked)}
            />
            Coaching en présentiel
          </label>
        </div>
      </div>

      {/* Save */}
      <div className="mt-7">
        {error ? (
          <div className="mb-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="w-full rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white/90 disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : "Continuer"}
        </button>
      </div>
    </div>
  )
}
