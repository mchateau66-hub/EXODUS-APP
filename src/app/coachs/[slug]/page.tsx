// src/app/coachs/[slug]/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOnboardingStep } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function toList(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((x) => x.trim()).filter(Boolean);
  return [];
}

export default async function CoachProfilePage({
  params,
}: {
  params: { slug: string };
}) {
  const { user } = await requireOnboardingStep(3);

  // Cette section est “athlète” : on renvoie les coachs sur leur dashboard
  if ((user as any).role === "coach") redirect("/coach");

  const coach = await prisma.coach.findFirst({
    where: { slug: params.slug },
    select: {
      id: true,
      slug: true,
      name: true,
      subtitle: true,
      avatarInitial: true,
      user: {
        select: {
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
  const step1 = coachUser?.onboardingStep1Answers ?? {};
  const step2 = coachUser?.onboardingStep2Answers ?? {};

  const sports = toList(step2?.mainSports);
  const keywords = toList(step2?.keywords);

  const country = coachUser?.country ?? "—";
  const language = coachUser?.language ?? "—";
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

  const initial = (coach.avatarInitial ?? coach.name.charAt(0)).toUpperCase();

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_30%,rgba(56,189,248,0.14),transparent_60%),radial-gradient(900px_500px_at_20%_80%,rgba(168,85,247,0.12),transparent_60%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70" />

      <div className="relative mx-auto max-w-4xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/coachs"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            <span aria-hidden>←</span> Retour
          </Link>

          <Link
            href={`/messages?coachId=${coach.slug}`}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white/90"
          >
            Ouvrir la messagerie <span aria-hidden>→</span>
          </Link>
        </div>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-7 shadow-[0_25px_70px_rgba(0,0,0,0.25)] backdrop-blur">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">
                {initial}
              </div>

              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight">{coach.name}</h1>
                {coach.subtitle && (
                  <p className="mt-1 text-sm text-white/70">{coach.subtitle}</p>
                )}
                {personaLabel && (
                  <p className="mt-2 text-xs text-white/60">
                    Style : <span className="text-white/80 font-semibold">{personaLabel}</span>
                  </p>
                )}
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

          <div className="mt-8 flex flex-wrap justify-end gap-2">
            <Link
              href="/coachs"
              className="inline-flex items-center gap-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Voir d’autres coachs
            </Link>
            <Link
              href={`/messages?coachId=${coach.slug}`}
              className="inline-flex items-center gap-1 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white/90"
            >
              Contacter ce coach <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
