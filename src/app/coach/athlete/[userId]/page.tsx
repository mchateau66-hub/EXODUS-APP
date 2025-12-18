// src/app/coach/athlete/[userId]/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import type { CoachAthleteStatus } from '@prisma/client'
import type React from 'react'
import CoachAthleteCardClient from './CoachAthleteCardClient'
import { requireOnboardingStep } from '@/lib/onboarding'
import CoachAthletePipelineEditorClient from '@/components/coach/CoachAthletePipelineEditorClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

type PageProps = {
  params: {
    userId: string
  }
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  })
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

type CoachAthleteForClient = {
  coach_id: string
  status: CoachAthleteStatus
  labels: string[]
  nextFollowUpAt: string | null
  pinned: boolean
  coach: {
    id: string
    name: string
    slug: string
    subtitle: string | null
    avatarInitial: string | null
  }
}

// ✅ Adapter: évite l’erreur TS si le composant n’expose pas `initial` dans ses Props
// et permet de rester compatible si le composant attend plutôt des props éclatées.
const CoachAthletePipelineEditorAny =
  CoachAthletePipelineEditorClient as unknown as React.ComponentType<any>

export default async function CoachAthleteDetailPage({ params }: PageProps) {
  const { userId: athleteId } = params

  // 🔒 1) Auth + onboardingStep >= 3
  const { user: sessionUser } = await requireOnboardingStep(3)

  // 🔒 2) Rôle coach obligatoire
  if ((sessionUser as any).role !== 'coach') {
    redirect('/messages')
  }

  // 🔒 3) Retrouver le profil coach lié à ce user
  const coach = await prisma.coach.findFirst({
    where: { user_id: sessionUser.id },
  })

  if (!coach) {
    redirect('/coach')
  }

  /**
   * 4) Récupération athlète + profil + infos d'onboarding
   */
  const athlete = await prisma.user.findUnique({
    where: { id: athleteId },
    select: {
      id: true,
      email: true,
      name: true,
      age: true,
      country: true,
      language: true,
      onboardingStep1Answers: true,
      onboardingStep2Answers: true,
      athleteProfile: {
        select: {
          objectiveSummary: true,
          goalType: true,
          timeframe: true,
          experienceLevel: true,
          context: true,
        },
      },
    },
  })

  if (!athlete) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow">
          <h1 className="mb-2 text-lg font-semibold text-slate-900">
            Athlète introuvable
          </h1>
          <p className="mb-4 text-sm text-slate-500">
            L&apos;athlète demandé n&apos;existe pas ou plus.
          </p>
          <Link
            href="/coach"
            className="text-sm font-medium text-slate-700 underline underline-offset-2"
          >
            Retour au tableau de bord coach
          </Link>
        </section>
      </main>
    )
  }

  const email = athlete.email ?? ''
  const baseLabel =
    athlete.name || email.split('@')[0] || `Athlète ${athlete.id.slice(0, 6)}`
  const athleteLabel = baseLabel

  const profile = athlete.athleteProfile

  const step1 = ((athlete as any).onboardingStep1Answers ?? {}) as any
  const step2 = ((athlete as any).onboardingStep2Answers ?? {}) as any

  const socialRole = typeof step1.socialRole === 'string' ? step1.socialRole : null
  const personaType = typeof step1.personaType === 'string' ? step1.personaType : null

  const personaLabel =
    personaType === 'debutant'
      ? 'Débutant'
      : personaType === 'intermediaire'
        ? 'Intermédiaire'
        : personaType === 'avance'
          ? 'Avancé'
          : personaType === 'haut_niveau'
            ? 'Haut niveau / compétiteur'
            : null

  const mainSport = typeof step2.mainSport === 'string' ? step2.mainSport : null
  const secondarySports =
    typeof step2.secondarySports === 'string' ? step2.secondarySports : null

  const budgetRange = step2.budgetRange as 'low' | 'medium' | 'high' | undefined
  const budgetLabel =
    budgetRange === 'low'
      ? '< 80 €/mois'
      : budgetRange === 'medium'
        ? '80–150 €/mois'
        : budgetRange === 'high'
          ? '> 150 €/mois'
          : null

  const coachPersonality = step2.coachPersonality as
    | 'bienveillant'
    | 'direct'
    | 'pedagogue'
    | 'exigeant'
    | undefined

  const coachPersonalityLabel =
    coachPersonality === 'bienveillant'
      ? 'Bienveillant'
      : coachPersonality === 'pedagogue'
        ? 'Pédagogue'
        : coachPersonality === 'direct'
          ? 'Direct'
          : coachPersonality === 'exigeant'
            ? 'Exigeant'
            : null

  const preferredFollowupDuration = step2.preferredFollowupDuration as
    | 'short'
    | 'medium'
    | 'long'
    | undefined

  const followupLabel =
    preferredFollowupDuration === 'short'
      ? '1–3 mois'
      : preferredFollowupDuration === 'medium'
        ? '3–6 mois'
        : preferredFollowupDuration === 'long'
          ? '6+ mois'
          : null

  const prefersRemote = step2.prefersRemote === true
  const prefersInPerson = step2.prefersInPerson === true

  const location = typeof step2.location === 'string' ? step2.location : null

  const age = typeof (athlete as any).age === 'number' ? ((athlete as any).age as number) : null
  const country =
    typeof (athlete as any).country === 'string' ? ((athlete as any).country as string) : null
  const language =
    typeof (athlete as any).language === 'string' ? ((athlete as any).language as string) : null

  /**
   * 5) Messages entre CE coach et CET athlète
   */
  const messages = await prisma.message.findMany({
    where: {
      user_id: athlete.id,
      coach_id: coach.id,
    },
    orderBy: { created_at: 'asc' },
    include: {
      coach: {
        select: {
          id: true,
          name: true,
          slug: true,
          avatarInitial: true,
        },
      },
    },
  })

  /**
   * 6) Relation CoachAthlete pour CE coach & CET athlète
   */
  const coachAthleteRow = await prisma.coachAthlete.findUnique({
    where: {
      coach_id_athlete_id: {
        coach_id: coach.id,
        athlete_id: athlete.id,
      },
    },
    include: {
      coach: {
        select: {
          id: true,
          name: true,
          slug: true,
          subtitle: true,
          avatarInitial: true,
        },
      },
    },
  })

  const coachAthletes: CoachAthleteForClient[] = coachAthleteRow
    ? [
        {
          coach_id: coachAthleteRow.coach_id,
          status: coachAthleteRow.status,
          labels: coachAthleteRow.labels,
          nextFollowUpAt: coachAthleteRow.nextFollowUpAt
            ? coachAthleteRow.nextFollowUpAt.toISOString()
            : null,
          pinned: coachAthleteRow.pinned,
          coach: {
            id: coachAthleteRow.coach.id,
            name: coachAthleteRow.coach.name,
            slug: coachAthleteRow.coach.slug,
            subtitle: coachAthleteRow.coach.subtitle,
            avatarInitial: coachAthleteRow.coach.avatarInitial,
          },
        },
      ]
    : []

  const pipelineInitial = {
    status: (coachAthleteRow?.status ?? 'LEAD') as CoachAthleteStatus,
    labels: (coachAthleteRow?.labels ?? []) as string[],
    nextFollowUpAt: coachAthleteRow?.nextFollowUpAt
      ? coachAthleteRow.nextFollowUpAt.toISOString()
      : null,
    pinned: !!coachAthleteRow?.pinned,
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
        {/* HEADER */}
        <header className="border-b border-slate-200 px-6 py-5">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Espace coach · Fiche athlète
          </p>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-slate-50">
                {athleteLabel.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">{athleteLabel}</h1>
                {email && <p className="text-xs text-slate-400">{email}</p>}

                {socialRole && <p className="mt-1 text-xs text-slate-500">{socialRole}</p>}

                {profile?.goalType && (
                  <p className="mt-1 text-xs text-slate-500">
                    Objectif principal : {profile.goalType}
                  </p>
                )}

                {personaLabel && (
                  <p className="mt-1 text-xs text-slate-500">
                    Type d&apos;athlète : {personaLabel}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 text-right">
              <Link
                href="/coach"
                className="text-[11px] font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
              >
                Retour au tableau de bord
              </Link>
              <Link
                href={`/messages?coachId=${coach.slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-slate-50 shadow-sm hover:bg-slate-800"
              >
                Ouvrir la messagerie avec cet athlète
              </Link>
            </div>
          </div>

          {/* … (le reste de ton header est inchangé) … */}

          {/* BLOC RELATION COACH ↔ ATHLÈTE */}
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Relation coach ↔ athlète
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Statut de suivi, tags et prochaines relances pour toi avec cet athlète.
              </p>
            </div>

            {coachAthletes.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-600">
                Aucun lien de suivi n’est encore enregistré. Tu peux le créer ici (première sauvegarde).
              </div>
            )}

            {/* ✅ Rendu compatible: on envoie `initial` + variantes éclatées */}
            <CoachAthletePipelineEditorAny
              athleteId={athlete.id}
              initial={pipelineInitial}
              initialStatus={pipelineInitial.status}
              initialLabels={pipelineInitial.labels}
              initialNextFollowUpAt={pipelineInitial.nextFollowUpAt}
              initialPinned={pipelineInitial.pinned}
            />

            {coachAthletes.length > 0 && (
              <div className="space-y-2">
                {coachAthletes.map((ca) => (
                  <CoachAthleteCardClient key={ca.coach_id} athleteId={athlete.id} item={ca} />
                ))}
              </div>
            )}

            <div className="mt-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-[11px] text-slate-500">
              <p className="mb-1 font-semibold text-slate-700">
                Planning d&apos;entraînement
              </p>
              <p>
                Le détail des séances est géré dans l&apos;outil d&apos;entraînement du coach.
                Cette app se concentre sur la messagerie et le suivi des objectifs.
              </p>
            </div>
          </div>
        </header>

        {/* TIMELINE DES MESSAGES */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <section>
            <h2 className="mb-3 text-[13px] font-semibold text-slate-900">
              Historique des messages
            </h2>

            {messages.length === 0 ? (
              <p className="text-xs text-slate-400">
                Aucun message envoyé pour l&apos;instant entre toi et cet athlète.
              </p>
            ) : (
              <div className="space-y-3 text-xs text-slate-700">
                {messages.map((m, index) => {
                  const createdAt = m.created_at as Date
                  const prev = index > 0 ? messages[index - 1] : null
                  const prevDate = prev?.created_at ? (prev.created_at as Date) : null
                  const showSeparator = !prevDate || !isSameDay(prevDate, createdAt)

                  const msgCoach = m.coach as { name: string | null } | null | undefined
                  const coachLabel = msgCoach?.name || coach.name || 'Coach'

                  return (
                    <div key={m.id}>
                      {showSeparator && (
                        <div className="mb-2 mt-4 text-center text-[11px] font-medium text-slate-400">
                          {formatDayLabel(createdAt)}
                        </div>
                      )}

                      <div className="flex items-start gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-slate-50">
                          {athleteLabel.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-1 flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-semibold text-slate-900">
                                {athleteLabel}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                → {coachLabel}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {formatTime(createdAt)}
                            </span>
                          </div>
                          <p className="m-0 text-[13px] leading-relaxed">{m.content}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  )
}
