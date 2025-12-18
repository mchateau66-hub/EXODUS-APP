"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { COACH_KEYWORDS } from "@/data/coachKeywords";

function parseList(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function uniq(list: string[]) {
  return Array.from(new Set(list));
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

function sanitizeCsvValue(s: string) {
  return s.replace(/,/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function Chip({
  label,
  selected,
  onClick,
  onRemove,
}: {
  label: string;
  selected: boolean;
  onClick?: () => void;
  onRemove?: () => void;
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
  );
}

const PERSONALITIES: Array<{ value: string; label: string }> = [
  { value: "bienveillant", label: "Bienveillant" },
  { value: "pedagogue", label: "Pédagogue" },
  { value: "direct", label: "Direct" },
  { value: "exigeant", label: "Exigeant" },
];

const LANGUAGES: Array<{ value: string; label: string }> = [
  { value: "fr", label: "FR" },
  { value: "en", label: "EN" },
  { value: "es", label: "ES" },
  { value: "de", label: "DE" },
  { value: "it", label: "IT" },
];

const BUDGETS: Array<{ value: string; label: string }> = [
  { value: "low", label: "< 80€/mois" },
  { value: "medium", label: "80–150€/mois" },
  { value: "high", label: "> 150€/mois" },
];

const POPULAR_KEYWORDS = [
  "Perte de poids",
  "Prise de masse",
  "Musculation",
  "Prévention blessures",
  "Mobilité",
  "Nutrition",
  "Course à pied",
  "Réathlétisation",
];

const MAX_SELECTED_KEYWORDS = 25;
const MAX_SELECTED_SPORTS = 20;

// Fallback si /api/sports n’est pas dispo
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
  "Basket",
  "Tennis",
  "Padel",
  "Escalade",
];

type SportItem = { label: string; count?: number };

export default function CoachFiltersClient() {
  return (
    <Suspense fallback={null}>
      <CoachFiltersClientInner />
    </Suspense>
  );
}

function CoachFiltersClientInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const spKey = sp.toString(); // resync

  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");

  // ✅ Sports (multi)
  const [sportList, setSportList] = useState<string[]>([]);
  const [sportQuery, setSportQuery] = useState("");
  const debouncedSportQuery = useDebouncedValue(sportQuery, 160);
  const [sportOpen, setSportOpen] = useState(false);
  const [sportActiveIndex, setSportActiveIndex] = useState(0);
  const [sportSuggestions, setSportSuggestions] = useState<string[]>([]);
  const [popularSports, setPopularSports] = useState<string[]>(FALLBACK_SPORTS.slice(0, 10));
  const sportBoxRef = useRef<HTMLDivElement | null>(null);
  const sportInputRef = useRef<HTMLInputElement | null>(null);

  // ✅ Keywords (multi)
  const [keywordList, setKeywordList] = useState<string[]>([]);
  const [langList, setLangList] = useState<string[]>([]);
  const [personality, setPersonality] = useState<string>("");
  const [budget, setBudget] = useState<string>("");

  // Autocomplete keywords
  const [kwQuery, setKwQuery] = useState("");
  const [kwOpen, setKwOpen] = useState(false);
  const [kwActiveIndex, setKwActiveIndex] = useState(0);
  const kwBoxRef = useRef<HTMLDivElement | null>(null);
  const kwInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state <- URL
  useEffect(() => {
    setQ(sp.get("q") ?? "");
    setCountry(sp.get("country") ?? "");

    setSportList(parseList(sp.get("sport")));
    setKeywordList(parseList(sp.get("keywords")));

    setLangList(parseList(sp.get("language")));
    setPersonality(sp.get("personality") ?? "");
    setBudget(sp.get("budget") ?? "");
  }, [spKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFiltered = useMemo(() => {
    return Boolean(
      q ||
        country ||
        sportList.length ||
        keywordList.length ||
        langList.length ||
        personality ||
        budget
    );
  }, [q, country, sportList, keywordList, langList, personality, budget]);

  const applyToUrl = useCallback(
    (next: {
      q?: string;
      country?: string;
      sportList?: string[];
      keywordList?: string[];
      langList?: string[];
      personality?: string;
      budget?: string;
    }) => {
      const params = new URLSearchParams(sp.toString());

      const nextQ = next.q ?? q;
      const nextCountry = next.country ?? country;

      const nextSports = next.sportList ?? sportList;
      const nextKeywords = next.keywordList ?? keywordList;

      const nextLangs = next.langList ?? langList;
      const nextPers = next.personality ?? personality;
      const nextBudget = next.budget ?? budget;

      if (nextQ.trim()) params.set("q", nextQ.trim());
      else params.delete("q");

      if (nextCountry.trim()) params.set("country", nextCountry.trim());
      else params.delete("country");

      if (nextSports.length) {
        params.set("sport", uniq(nextSports).slice(0, MAX_SELECTED_SPORTS).join(","));
      } else params.delete("sport");

      if (nextKeywords.length) {
        params.set("keywords", uniq(nextKeywords).slice(0, MAX_SELECTED_KEYWORDS).join(","));
      } else params.delete("keywords");

      if (nextLangs.length) params.set("language", uniq(nextLangs).join(","));
      else params.delete("language");

      if (nextPers) params.set("personality", nextPers);
      else params.delete("personality");

      if (nextBudget) params.set("budget", nextBudget);
      else params.delete("budget");

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [
      sp,
      router,
      pathname,
      q,
      country,
      sportList,
      keywordList,
      langList,
      personality,
      budget,
    ]
  );

  const toggleMulti = useCallback((list: string[], value: string) => {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }, []);

  /**
   * ✅ Sports: fetch popular (1 fois)
   */
  useEffect(() => {
    let cancelled = false;

    async function loadPopular() {
      try {
        const res = await fetch(`/api/sports?limit=12`, { cache: "no-store" });
        if (!res.ok) throw new Error("sports popular not ok");
        const data = (await res.json()) as { sports?: SportItem[] };
        const list = (data.sports ?? []).map((x) => x.label).filter(Boolean);
        if (!cancelled && list.length) setPopularSports(list.slice(0, 12));
      } catch {
        // fallback déjà set
      }
    }

    loadPopular();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * ✅ Sports: fetch autocomplete (debounced)
   */
  useEffect(() => {
    let cancelled = false;

    async function loadSuggestions() {
      const q = debouncedSportQuery.trim();
      if (!q) {
        // suggestions = populaires qui ne sont pas déjà sélectionnés
        const selected = new Set(sportList.map(norm));
        const base = popularSports.filter((s) => !selected.has(norm(s)));
        if (!cancelled) setSportSuggestions(base.slice(0, 10));
        return;
      }

      try {
        const res = await fetch(
          `/api/sports?q=${encodeURIComponent(q)}&limit=10`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("sports q not ok");
        const data = (await res.json()) as { sports?: SportItem[] };
        const list = (data.sports ?? []).map((x) => x.label).filter(Boolean);

        const selected = new Set(sportList.map(norm));
        const filtered = list.filter((s) => !selected.has(norm(s)));

        if (!cancelled) setSportSuggestions(filtered.slice(0, 10));
      } catch {
        // fallback local
        const selected = new Set(sportList.map(norm));
        const qn = norm(q);
        const fallback = FALLBACK_SPORTS.filter(
          (s) => norm(s).includes(qn) && !selected.has(norm(s))
        ).slice(0, 10);
        if (!cancelled) setSportSuggestions(fallback);
      }
    }

    loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [debouncedSportQuery, sportList, popularSports]);

  const addSport = useCallback(
    (value: string) => {
      const v = sanitizeCsvValue(value);
      if (!v) return;
      if (sportList.map(norm).includes(norm(v))) return;
      if (sportList.length >= MAX_SELECTED_SPORTS) return;

      const next = uniq([...sportList, v]).slice(0, MAX_SELECTED_SPORTS);
      setSportList(next);
      applyToUrl({ sportList: next });

      setSportQuery("");
      setSportActiveIndex(0);
      setSportOpen(false);
      sportInputRef.current?.focus();
    },
    [sportList, applyToUrl]
  );

  const removeSport = useCallback(
    (value: string) => {
      const next = sportList.filter((x) => x !== value);
      setSportList(next);
      applyToUrl({ sportList: next });
    },
    [sportList, applyToUrl]
  );

  /**
   * Keywords logic (inchangé)
   */
  const availableKeywords = useMemo(() => {
    const selected = new Set(keywordList.map(norm));
    return COACH_KEYWORDS.filter((k) => !selected.has(norm(k)));
  }, [keywordList]);

  const kwSuggestions = useMemo(() => {
    const qn = norm(kwQuery);
    const base = availableKeywords;
    const filtered = qn ? base.filter((k) => norm(k).includes(qn)) : base;
    return filtered.slice(0, 10);
  }, [kwQuery, availableKeywords]);

  const addKeyword = useCallback(
    (value: string) => {
      const v = sanitizeCsvValue(value);
      if (!v) return;
      if (keywordList.map(norm).includes(norm(v))) return;
      if (keywordList.length >= MAX_SELECTED_KEYWORDS) return;

      const next = uniq([...keywordList, v]).slice(0, MAX_SELECTED_KEYWORDS);
      setKeywordList(next);
      applyToUrl({ keywordList: next });

      setKwQuery("");
      setKwActiveIndex(0);
      setKwOpen(false);
      kwInputRef.current?.focus();
    },
    [keywordList, applyToUrl]
  );

  const removeKeyword = useCallback(
    (value: string) => {
      const next = keywordList.filter((x) => x !== value);
      setKeywordList(next);
      applyToUrl({ keywordList: next });
    },
    [keywordList, applyToUrl]
  );

  // close suggestions on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as Node;

      if (kwBoxRef.current && !kwBoxRef.current.contains(target)) setKwOpen(false);
      if (sportBoxRef.current && !sportBoxRef.current.contains(target)) setSportOpen(false);
    }

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_70px_rgba(0,0,0,0.25)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Filtres</h2>
        {isFiltered ? (
          <Link
            href="/coachs"
            className="text-xs font-medium text-white/60 underline underline-offset-2 hover:text-white/80"
          >
            Réinitialiser
          </Link>
        ) : null}
      </div>

      {/* Recherche / Pays */}
      <div className="mt-4 grid gap-3">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-white/70" htmlFor="filter-q">
            Recherche
          </label>
          <input
            id="filter-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyToUrl({ q });
              }
            }}
            placeholder="Nom, spécialité…"
            className="w-full rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />
        </div>

        <div className="grid gap-1">
          <label className="text-xs font-medium text-white/70" htmlFor="filter-country">
            Pays
          </label>
          <input
            id="filter-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyToUrl({ country });
              }
            }}
            placeholder="FR, BE, CA…"
            className="w-full rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
          />
        </div>
      </div>

      {/* ✅ Sports (multi) + autocomplete via /api/sports */}
      <div className="mt-6" ref={sportBoxRef}>
        <div className="text-xs font-semibold text-white/70">Sports</div>

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
          <label className="sr-only" htmlFor="sport-autocomplete">
            Ajouter un sport
          </label>

          <input
            id="sport-autocomplete"
            ref={sportInputRef}
            value={sportQuery}
            onChange={(e) => {
              setSportQuery(e.target.value);
              setSportOpen(true);
              setSportActiveIndex(0);
            }}
            onFocus={() => {
              setSportOpen(true);
              setSportActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSportOpen(true);
                setSportActiveIndex((i) => Math.min(i + 1, sportSuggestions.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSportActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (sportSuggestions.length > 0) {
                  addSport(sportSuggestions[sportActiveIndex] ?? sportSuggestions[0]);
                } else {
                  addSport(sportQuery); // custom si aucun résultat
                }
              } else if (e.key === "Escape") {
                setSportOpen(false);
              } else if (e.key === "Backspace" && !sportQuery && sportList.length) {
                removeSport(sportList[sportList.length - 1]);
              }
            }}
            placeholder="Ajouter un sport… (ex: trail, yoga, boxe)"
            className="w-full rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
            role="combobox"
            aria-expanded={sportOpen}
            aria-controls="sport-suggestions"
            aria-autocomplete="list"
          />

          {sportOpen ? (
            <div
              id="sport-suggestions"
              role="listbox"
              className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-[0_25px_70px_rgba(0,0,0,0.6)] backdrop-blur"
            >
              {sportSuggestions.length === 0 ? (
                <div className="px-3 py-3 text-xs text-white/60">
                  Aucun résultat. Appuie sur <span className="font-semibold text-white/85">Entrée</span>{" "}
                  pour ajouter “{sanitizeCsvValue(sportQuery) || "…"}”.
                </div>
              ) : (
                sportSuggestions.map((s, idx) => {
                  const active = idx === sportActiveIndex;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setSportActiveIndex(idx)}
                      onClick={() => addSport(s)}
                      className={[
                        "w-full px-3 py-2 text-left text-sm",
                        active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5",
                      ].join(" ")}
                    >
                      {s}
                    </button>
                  );
                })
              )}
            </div>
          ) : null}

          <div className="mt-2 text-[11px] text-white/45">
            {sportList.length}/{MAX_SELECTED_SPORTS} sélectionnés
          </div>
        </div>

        {/* Sports populaires */}
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
            Populaires
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {popularSports.slice(0, 12).map((s) => (
              <Chip
                key={s}
                label={s}
                selected={sportList.map(norm).includes(norm(s))}
                onClick={() => {
                  const selected = sportList.map(norm).includes(norm(s));
                  if (selected) {
                    const real = sportList.find((x) => norm(x) === norm(s)) ?? s;
                    removeSport(real);
                  } else {
                    addSport(s);
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Keywords (multi) + autocomplete */}
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
          <label className="sr-only" htmlFor="kw-autocomplete">
            Ajouter un mot-clé
          </label>

          <input
            id="kw-autocomplete"
            ref={kwInputRef}
            value={kwQuery}
            onChange={(e) => {
              setKwQuery(e.target.value);
              setKwOpen(true);
              setKwActiveIndex(0);
            }}
            onFocus={() => setKwOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setKwOpen(true);
                setKwActiveIndex((i) => Math.min(i + 1, kwSuggestions.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setKwActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (kwSuggestions.length > 0) addKeyword(kwSuggestions[kwActiveIndex] ?? kwSuggestions[0]);
                else addKeyword(kwQuery);
              } else if (e.key === "Escape") {
                setKwOpen(false);
              } else if (e.key === "Backspace" && !kwQuery && keywordList.length) {
                removeKeyword(keywordList[keywordList.length - 1]);
              }
            }}
            placeholder="Ajouter un mot-clé… (ex: mobilité, nutrition, perte de poids)"
            className="w-full rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
            role="combobox"
            aria-expanded={kwOpen}
            aria-controls="kw-suggestions"
            aria-autocomplete="list"
          />

          {kwOpen ? (
            <div
              id="kw-suggestions"
              role="listbox"
              className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-[0_25px_70px_rgba(0,0,0,0.6)] backdrop-blur"
            >
              {kwSuggestions.length === 0 ? (
                <div className="px-3 py-3 text-xs text-white/60">
                  Aucun résultat. Appuie sur <span className="font-semibold text-white/85">Entrée</span>{" "}
                  pour ajouter “{sanitizeCsvValue(kwQuery) || "…"}”.
                </div>
              ) : (
                kwSuggestions.map((k, idx) => {
                  const active = idx === kwActiveIndex;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setKwActiveIndex(idx)}
                      onClick={() => addKeyword(k)}
                      className={[
                        "w-full px-3 py-2 text-left text-sm",
                        active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5",
                      ].join(" ")}
                    >
                      {k}
                    </button>
                  );
                })
              )}
            </div>
          ) : null}

          <div className="mt-2 text-[11px] text-white/45">
            {keywordList.length}/{MAX_SELECTED_KEYWORDS} sélectionnés
          </div>
        </div>

        {/* Populaires keywords */}
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
                  const selected = keywordList.map(norm).includes(norm(k));
                  if (selected) {
                    const real = keywordList.find((x) => norm(x) === norm(k)) ?? k;
                    removeKeyword(real);
                  } else {
                    addKeyword(k);
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Style (single) */}
      <div className="mt-7">
        <div className="text-xs font-semibold text-white/70">Style de coach</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {PERSONALITIES.map((p) => (
            <Chip
              key={p.value}
              label={p.label}
              selected={personality === p.value}
              onClick={() => {
                const next = personality === p.value ? "" : p.value;
                setPersonality(next);
                applyToUrl({ personality: next });
              }}
            />
          ))}
        </div>
      </div>

      {/* Langues (multi) */}
      <div className="mt-7">
        <div className="text-xs font-semibold text-white/70">Langues</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <Chip
              key={l.value}
              label={l.label}
              selected={langList.includes(l.value)}
              onClick={() => {
                const next = toggleMulti(langList, l.value);
                setLangList(next);
                applyToUrl({ langList: next });
              }}
            />
          ))}
        </div>
      </div>

      {/* Budget (single) */}
      <div className="mt-7">
        <div className="text-xs font-semibold text-white/70">Budget</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {BUDGETS.map((b) => (
            <Chip
              key={b.value}
              label={b.label}
              selected={budget === b.value}
              onClick={() => {
                const next = budget === b.value ? "" : b.value;
                setBudget(next);
                applyToUrl({ budget: next });
              }}
            />
          ))}
        </div>
      </div>

      {/* Appliquer */}
      <button
        type="button"
        onClick={() =>
          applyToUrl({
            q,
            country,
            sportList,
            keywordList,
            langList,
            personality,
            budget,
          })
        }
        className="mt-7 w-full rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white/90"
      >
        Appliquer
      </button>

      <p className="mt-3 text-xs text-white/55">
        URL partageable (sports / keywords / langues en multi-sélection).
      </p>
    </div>
  );
}
