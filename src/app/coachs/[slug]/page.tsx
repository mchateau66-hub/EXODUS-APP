// src/app/coachs/[slug]/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOnboardingStep } from "@/lib/onboarding";

import CoachVerificationBadge from "@/components/coach/CoachVerificationBadge";
import {
  type CoachVerificationStatus,
  coachVerificationCopy,
  isCoachVerified,
  normalizeCoachVerificationStatus,
} from "@/lib/coachVerification";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function toList(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((x) => x.trim()).filter(Boolean);
  return [];
}

/**
 * Agrège plusieurs statuts (multi-docs) en un seul statut UI stable.
 * Règle: rejected > needs_review > verified (si tout verified) > missing > unknown
 */
function computeCoachVerificationStatus(statuses: string[]): CoachVerificationStatus {
  if (!statuses || statuses.length === 0) return "missing";

  const normalized = statuses.map((s) => normalizeCoachVerificationStatus(s));

  if (normalized.includes("rejected")) return "rejected";
  if (normalized.includes("needs_review")) return "needs_review";
  if (normalized.every((s) => s === "verified")) return "verified";
  if (normalized.includes("missing")) return "missing";

  return "unknown";
}

function bannerStyles(status: CoachVerificationStatus): { className: string; title: string } {
  switch (status) {
    case "needs_review":
      return {
        className: "border-amber-400/20 bg-amber-400/10 text-amber-50",
        title: "Coach en cours de vérification",
      };
    case "missing":
      return {
        className: "border-white/15 bg-white/5 text-white",
        title: "Coach non vérifié",
      };
    case "rejected":
      return {
        className: "border-rose-400/25 bg-rose-400/10 text-rose-50",
        title: "Vérification refusée",
      };
    default:
      return {
        className: "border-white/15 bg-white/5 text-white",
        title: "Statut de vérification",
      };
  }
}

export default async function CoachProfilePage({
  params,
}: {
  params: { slug: string } | Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await requireOnboardingStep(3);

  if ((user as any).role === "coach") redirect("/coach");

  const coach = await prisma.coach.findFirst({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      subtitle: true,
      avatarInitial: true,
      user: {
        select: {
          id: true,
          country: true,
          language: true,
          coachQualificationScore: true,
          onboardingStep1Answers: true,
          onboardingStep2Answers: true,
        },
      },
    },
  });

  if (!coach) notFound();

  const coachUser = coach.user as any;

  const docRows = await prisma.coachDocument.findMany({
    where: { user_id: String(coachUser?.id ?? "") },
    select: { status: true },
  });

  const statuses = docRows.map((d) => String(d.status));
  const verifyStatus = computeCoachVerificationStatus(statuses);

  const canMessage = isCoachVerified(verifyStatus);
  const showBanner = !canMessage;

  const copy = coachVerificationCopy(verifyStatus);
  const banner = bannerStyles(verifyStatus);

  const step1 = coachUser?.onboardingStep1Answers ?? {};
  const step2 = coachUser?.onboardingStep2Answers ?? {};

  const sports = toList(step2?.mainSports);
  const keywords = toList(step2?.keywords);

  const country = coachUser?.country ?? "—";
  const language = coachUser?.language ?? "—";
  const qual =
    typeof coachUser?.coachQualificationScore === "number" ? coachUser.coachQualificationScore : 0;

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

  const initial = (coach.avatarInitial ?? coach.name.charAt(0)).toUpperCase();

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_30%,rgba(56,189,248,0.14),transparent_60%),radial-gradient(900px_500px_at_20%_80%,rgba(168,85,247,0.12),transparent_60%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70" />

      <div className="relative mx-auto max-w-4xl px-6 py-10">
        {/* Top actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/coachs"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            <span aria-hidden>←</span> Retour
          </Link>

          <div className="flex flex-col items-end gap-2">
            {canMessage ? (
              <Link
                href={`/messages?coachId=${coach.slug}`}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white/90"
              >
                Ouvrir la messagerie <span aria-hidden>→</span>
              </Link>
            ) : (
              <button
                type="button"
                disabled
                title="Messagerie disponible uniquement quand le coach est vérifié"
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-2xl bg-white/70 px-4 py-2 text-sm font-semibold text-slate-950 opacity-60"
              >
                Ouvrir la messagerie <span aria-hidden>→</span>
              </button>
            )}

            {!canMessage ? (
              <p className="text-xs text-white/55">
                Messagerie disponible uniquement pour les coachs{" "}
                <span className="text-white/75 font-semibold">vérifiés</span>.
              </p>
            ) : null}
          </div>
        </div>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-7 shadow-[0_25px_70px_rgba(0,0,0,0.25)] backdrop-blur">
          {/* ✅ Bandeau uniquement si non vérifié */}
          {showBanner ? (
            <div className={`mb-6 rounded-2xl border p-4 ${banner.className}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">{banner.title}</div>
                <CoachVerificationBadge status={verifyStatus} />
              </div>
              <p className="mt-1 text-xs opacity-90">
                {copy.hint ?? "Ce coach est en cours de vérification. La messagerie est désactivée."}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">
                {initial}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">{coach.name}</h1>
                  <CoachVerificationBadge status={verifyStatus} />
                </div>

                {coach.subtitle ? <p className="mt-1 text-sm text-white/70">{coach.subtitle}</p> : null}

                {personaLabel ? (
                  <p className="mt-2 text-xs text-white/60">
                    Style : <span className="text-white/80 font-semibold">{personaLabel}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:w-[320px]">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Pays</div>
                <div className="mt-1 text-sm font-semibold">{country}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Langue</div>
                <div className="mt-1 text-sm font-semibold">
                  {typeof language === "string" ? language.toUpperCase() : language}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Qualif</div>
                <div className="mt-1 text-sm font-semibold">{qual}/100</div>
              </div>
            </div>
          </div>

          {/* Sports */}
          <div className="mt-7">
            <div className="text-xs font-semibold text-white/80">Sports</div>
            {sports.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {sports.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white/75"
                  >
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-white/60">Aucun sport renseigné.</p>
            )}
          </div>

          {/* Keywords */}
          <div className="mt-7">
            <div className="text-xs font-semibold text-white/80">Mots-clés</div>
            {keywords.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {keywords.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white/75"
                  >
                    {k}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-white/60">Aucun mot-clé renseigné.</p>
            )}
          </div>

          {/* CTA bas */}
          <div className="mt-8 flex flex-wrap justify-end gap-2">
            <Link
              href="/coachs"
              className="inline-flex items-center gap-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Voir d’autres coachs
            </Link>

            {canMessage ? (
              <Link
                href={`/messages?coachId=${coach.slug}`}
                className="inline-flex items-center gap-1 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white/90"
              >
                Contacter ce coach <span aria-hidden>→</span>
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center gap-1 rounded-2xl bg-white/70 px-4 py-2 text-sm font-semibold text-slate-950 opacity-60"
                title="Disponible quand le coach est vérifié"
              >
                Contacter ce coach <span aria-hidden>→</span>
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
