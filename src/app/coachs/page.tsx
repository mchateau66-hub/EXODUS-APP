// src/app/coachs/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Prisma } from "@prisma/client";
import { requireOnboardingStep } from "@/lib/onboarding";
import { getCoachMatchesForAthlete } from "@/lib/matching";
import CoachFiltersClient from "./ui/CoachFiltersClient";
import { prisma } from "@/lib/db";

import CoachVerificationBadge from "@/components/coach/CoachVerificationBadge";
import {
  type CoachVerificationStatus,
  coachVerificationRank,
  isCoachVerified,
  normalizeCoachVerificationStatus,
} from "@/lib/coachVerification";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

function getStringParam(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function getListParam(sp: SearchParams, key: string): string[] {
  const v = sp[key];
  const raw = Array.isArray(v) ? v.join(",") : v ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

function toSportsList(mainSports: any): string[] {
  if (!mainSports) return [];
  if (Array.isArray(mainSports)) return mainSports.map(String).map((x) => x.trim()).filter(Boolean);
  if (typeof mainSports === "string") return mainSports.split(",").map((x) => x.trim()).filter(Boolean);
  return [];
}

function toKeywordsList(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((x) => x.trim()).filter(Boolean);
  return [];
}

function personaToFilterValue(personaType: any): string | null {
  switch (personaType) {
    case "coach_bienveillant":
      return "bienveillant";
    case "coach_pedagogue":
      return "pedagogue";
    case "coach_motivateur":
      return "direct";
    case "coach_expert":
      return "exigeant";
    default:
      return null;
  }
}

/**
 * Agrège plusieurs docs (statuts multiples) en un seul statut.
 * Règle: rejected > needs_review > verified (si tout verified) > missing > unknown
 */
function computeCoachVerification(statuses: string[]): CoachVerificationStatus {
  if (!statuses || statuses.length === 0) return "missing";

  const normalized = statuses.map((s) => normalizeCoachVerificationStatus(s));

  if (normalized.includes("rejected")) return "rejected";
  if (normalized.includes("needs_review")) return "needs_review";
  if (normalized.every((s) => s === "verified")) return "verified";
  if (normalized.includes("missing")) return "missing";

  return "unknown";
}

export default async function CoachsPage({
  searchParams = {},
}: {
  searchParams?: SearchParams;
}) {
  const session = await requireOnboardingStep(3);
  const { user } = session;

  const role = (user as any).role as "athlete" | "coach" | "admin";
  if (role === "coach") redirect("/coach");

  // URL -> valeurs
  const q = getStringParam(searchParams, "q");

  // ✅ pays par défaut = pays de l’utilisateur (si absent de l’URL)
  const countryParam = getStringParam(searchParams, "country");
  const defaultCountry = (user as any)?.country as string | undefined;
  const country = countryParam || defaultCountry;

  const sports = getListParam(searchParams, "sport");
  const languages = getListParam(searchParams, "language");
  const keywords = getListParam(searchParams, "keywords");

  const personality = getStringParam(searchParams, "personality") as
    | "bienveillant"
    | "direct"
    | "pedagogue"
    | "exigeant"
    | undefined;

  const budget = getStringParam(searchParams, "budget") as
    | "low"
    | "medium"
    | "high"
    | undefined;

  const matchesRaw = await getCoachMatchesForAthlete((user as any).id, {
    q: q || undefined,
    sport: sports.length <= 1 ? sports[0] || undefined : undefined,
    personality,
    language: languages.length <= 1 ? languages[0] || undefined : undefined,
    country: country || undefined,
    budget,
  });

  // --- Précharge statuts de vérification (CoachDocument) par coach.user.id ---
  const coachUserIds = Array.from(
    new Set(
      matchesRaw
        .map((m) => (m.coach?.user as any)?.id)
        .filter(Boolean)
        .map(String),
    ),
  );

  const docsByUserId = new Map<string, string[]>();

  if (coachUserIds.length > 0) {
    const rows = await prisma.coachDocument.findMany({
      where: { user_id: { in: coachUserIds } },
      select: { user_id: true, status: true },
    });

    for (const r of rows) {
      const uid = String(r.user_id);
      if (!docsByUserId.has(uid)) docsByUserId.set(uid, []);
      docsByUserId.get(uid)!.push(String(r.status));
    }
  }

  // ✅ Gating visibilité hub/listing : feature `hub.map.listing`
  // Fallback: si la vue SQL n’existe pas encore, on ne bloque pas l’affichage.
  let allowedListingSet: Set<string> | null = null;
  if (coachUserIds.length > 0) {
    try {
      const allowedRows = await prisma.$queryRaw<{ user_id: string }[]>(
        Prisma.sql`
          SELECT user_id
          FROM user_effective_entitlements
          WHERE user_id IN (${Prisma.join(coachUserIds.map((id) => Prisma.sql`${id}::uuid`))})
            AND 'hub.map.listing' = ANY(features)
        `,
      );
      allowedListingSet = new Set(allowedRows.map((r) => String(r.user_id)));
    } catch {
      allowedListingSet = null;
    }
  }

  // Post-filtrage OR (multi sports/langues/keywords)
  const sportsSet = new Set(sports.map(norm));
  const langSet = new Set(languages.map(norm));
  const kwSet = new Set(keywords.map(norm));

  const matchesFiltered = matchesRaw.filter(({ coach }) => {
    const coachUser = coach.user as any;
    const coachUserId = String(coachUser?.id ?? "");

    // ✅ si on a la liste des coachs autorisés, on filtre ici
    if (allowedListingSet && coachUserId && !allowedListingSet.has(coachUserId)) {
      return false;
    }

    const step1 = coachUser?.onboardingStep1Answers ?? {};
    const step2 = coachUser?.onboardingStep2Answers ?? {};

    // sports OR
    if (sportsSet.size > 0) {
      const coachSports = toSportsList(step2?.mainSports).map(norm);
      const ok = coachSports.some((s) => {
        for (const wanted of sportsSet) {
          if (s.includes(wanted) || wanted.includes(s)) return true;
        }
        return false;
      });
      if (!ok) return false;
    }

    // keywords OR
    if (kwSet.size > 0) {
      const coachKeywords = toKeywordsList(step2?.keywords).map(norm);
      const ok = coachKeywords.some((k) => {
        for (const wanted of kwSet) {
          if (k.includes(wanted) || wanted.includes(k)) return true;
        }
        return false;
      });
      if (!ok) return false;
    }

    // langues OR
    if (langSet.size > 0) {
      const coachLang = norm(String(coachUser?.language ?? ""));
      if (!langSet.has(coachLang)) return false;
    }

    // pays
    if (country && norm(String(coachUser?.country ?? "")) !== norm(country)) {
      return false;
    }

    // personality (single)
    if (personality) {
      const mapped = personaToFilterValue(step1?.personaType);
      if (mapped && mapped !== personality) return false;
    }

    return true;
  });

  // Enrich + re-rank
  const matchesEnriched = matchesFiltered.map(({ coach, score, isPremium }) => {
    const coachUser = coach.user as any;
    const step2 = coachUser?.onboardingStep2Answers ?? {};
    const coachKeywords = toKeywordsList(step2?.keywords);

    let kwOverlap = 0;
    if (kwSet.size > 0 && coachKeywords.length > 0) {
      const coachKwNorm = coachKeywords.map(norm);
      for (const ck of coachKwNorm) {
        for (const wanted of kwSet) {
          if (ck.includes(wanted) || wanted.includes(ck)) {
            kwOverlap += 1;
            break;
          }
        }
      }
    }

    const coachUserId = String((coach.user as any)?.id ?? "");
    const statuses = docsByUserId.get(coachUserId) ?? [];
    const verifyStatus = computeCoachVerification(statuses);

    return { coach, score, isPremium, coachKeywords, kwOverlap, verifyStatus };
  });

  const matchesFinal = matchesEnriched.sort((a, b) => {
    // 1) statut vérification: verified > needs_review > missing
    const vr = coachVerificationRank(a.verifyStatus) - coachVerificationRank(b.verifyStatus);
    if (vr !== 0) return vr;

    // 2) premium (optionnel)
    if (a.isPremium !== b.isPremium) return a.isPremium ? -1 : 1;

    // 3) keywords overlap (si filtre keywords actif)
    if (kwSet.size > 0) {
      const kw = (b.kwOverlap ?? 0) - (a.kwOverlap ?? 0);
      if (kw !== 0) return kw;
    }

    // 4) score matching
    return b.score - a.score;
  });

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_30%,rgba(56,189,248,0.14),transparent_60%),radial-gradient(900px_500px_at_20%_80%,rgba(168,85,247,0.12),transparent_60%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70" />

      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Tes coachs
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Choisis le coach avec qui échanger
            </h1>
            <p className="mt-2 text-sm text-white/70">
              Tri automatique + badge vérification. Tu peux partager l’URL avec tes filtres.
            </p>

            {country ? (
              <p className="mt-2 text-xs text-white/55">
                Pays par défaut appliqué :{" "}
                <span className="font-semibold text-white/75">{String(country).toUpperCase()}</span>
              </p>
            ) : null}

            {allowedListingSet !== null ? (
              <p className="mt-1 text-xs text-white/45">
                Visibilité Hub : seuls les coachs avec <span className="font-semibold">hub.map.listing</span> sont affichés.
              </p>
            ) : (
              <p className="mt-1 text-xs text-white/45">
                Visibilité Hub : fallback actif (vue entitlements non disponible).
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/hub"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Hub
            </Link>
            <Link
              href="/messages"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white/90"
            >
              Messagerie
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="lg:sticky lg:top-6 h-fit">
            <Suspense fallback={null}>
              <CoachFiltersClient />
            </Suspense>
          </aside>

          <section className="space-y-4">
            {matchesFinal.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-[0_25px_70px_rgba(0,0,0,0.25)] backdrop-blur">
                <div className="text-sm font-semibold text-white/85">
                  Aucun coach ne correspond à ces critères.
                </div>
                <p className="mt-2 text-sm text-white/65">Essaie d’élargir tes filtres.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {matchesFinal.map(({ coach, score, isPremium, coachKeywords, kwOverlap, verifyStatus }) => {
                  const coachUser = coach.user as any;
                  const step1 = coachUser?.onboardingStep1Answers ?? {};
                  const step2 = coachUser?.onboardingStep2Answers ?? {};

                  const sportsList = toSportsList(step2.mainSports);
                  const sportsPreview = sportsList.slice(0, 6);
                  const sportsMore = sportsList.length - sportsPreview.length;

                  const keywordsPreview = (coachKeywords ?? []).slice(0, 6);
                  const keywordsMore = (coachKeywords ?? []).length - keywordsPreview.length;

                  const countryDisplay = coachUser?.country ?? "—";
                  const languageDisplay = coachUser?.language ?? "—";

                  const qual =
                    typeof coachUser?.coachQualificationScore === "number"
                      ? coachUser.coachQualificationScore
                      : 0;

                  const personaType = step1?.personaType;
                  const personaLabel =
                    personaType === "coach_bienveillant"
                      ? "Bienveillant"
                      : personaType === "coach_pedagogue"
                        ? "Pédagogue"
                        : personaType === "coach_motivateur"
                          ? "Motivateur"
                          : personaType === "coach_expert"
                            ? "Expert"
                            : null;

                  const canMessage = isCoachVerified(verifyStatus);

                  return (
                    <article
                      key={coach.id}
                      className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_25px_70px_rgba(0,0,0,0.25)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/7"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                            {(coach.avatarInitial ?? coach.name.charAt(0)).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h2 className="truncate text-sm font-semibold text-white">
                                {coach.name}
                              </h2>

                              <CoachVerificationBadge status={verifyStatus} />
                            </div>

                            {coach.subtitle && (
                              <p className="mt-0.5 text-xs text-white/65">{coach.subtitle}</p>
                            )}

                            {/* ✅ Sports */}
                            {sportsPreview.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {sportsPreview.map((s) => (
                                  <span
                                    key={s}
                                    className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-white/70"
                                  >
                                    {s}
                                  </span>
                                ))}
                                {sportsMore > 0 && (
                                  <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-white/60">
                                    +{sportsMore}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* ✅ Keywords */}
                            {keywordsPreview.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {keywordsPreview.map((k) => (
                                  <span
                                    key={k}
                                    className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-white/70"
                                  >
                                    {k}
                                  </span>
                                ))}
                                {keywordsMore > 0 && (
                                  <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-white/60">
                                    +{keywordsMore}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-950">
                            <span>Match</span>
                            <span>{score.toFixed(0)}%</span>
                          </span>

                          {isPremium && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-1 text-[10px] font-medium text-amber-100 border border-amber-400/20">
                              ⭐ Premium
                            </span>
                          )}

                          {kwSet.size > 0 && kwOverlap > 0 && (
                            <span className="mt-1 inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-[10px] font-medium text-sky-100">
                              +{kwOverlap} mots-clés
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] text-white/60">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-2 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-white/35" />
                          {countryDisplay}
                        </span>

                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-2 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-white/35" />
                          Langue :{" "}
                          {typeof languageDisplay === "string"
                            ? languageDisplay.toUpperCase()
                            : languageDisplay}
                        </span>

                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-2 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-white/35" />
                          Qualif : {qual}/100
                        </span>

                        {personaLabel && (
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-2 py-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-white/35" />
                            Style : {personaLabel}
                          </span>
                        )}
                      </div>

                      {/* ✅ CTA */}
                      <div className="mt-5 flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/coachs/${coach.slug}`}
                          className="inline-flex items-center gap-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                        >
                          Voir le profil <span aria-hidden>→</span>
                        </Link>

                        {canMessage ? (
                          <Link
                            href={`/messages?coachId=${coach.slug}`}
                            className="inline-flex items-center gap-1 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white/90"
                          >
                            Messagerie <span aria-hidden>→</span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title="Messagerie disponible uniquement quand le coach est vérifié"
                            className="inline-flex cursor-not-allowed items-center gap-1 rounded-2xl bg-white/70 px-4 py-2 text-sm font-semibold text-slate-950 opacity-60"
                          >
                            Messagerie <span aria-hidden>→</span>
                          </button>
                        )}
                      </div>

                      {!canMessage && (
                        <p className="mt-3 text-xs text-white/55">
                          Messagerie activée uniquement pour les coachs{" "}
                          <span className="text-white/75 font-semibold">vérifiés</span>.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="pt-4 text-center">
              <Link
                href="/messages"
                className="text-xs font-medium text-white/60 underline underline-offset-2 hover:text-white/80"
              >
                Revenir à la messagerie
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
