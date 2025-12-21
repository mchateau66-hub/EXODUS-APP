// src/app/coach/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import type { CoachAthleteStatus } from '@prisma/client'
import { requireOnboardingStep } from '@/lib/onboarding'
import CoachConversationListClient from '@/components/coach/CoachConversationListClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

type ConversationKey = string

type Conversation = {
  coachId: string
  coachSlug: string
  coachName: string
  coachSubtitle: string | null
  coachAvatarInitial: string | null
  userId: string
  userLabel: string
  objectiveSummary: string | null
  goalType: string | null
  lastMessageAt: Date
  lastMessageContent: string
  messageCount: number
  status: CoachAthleteStatus | null
  labels: string[]
  nextFollowUpAt: Date | null
  pinned: boolean
}

type PageProps = {
  searchParams?: Promise<{
    status?: string
    q?: string
  }>
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * Utilisé uniquement pour le TRI côté serveur (ordre initial)
 * priority: 0 overdue, 1 today, 2 upcoming, 3 none
 */
function getFollowUpPriority(nextFollowUpAt: Date | null, now: Date) {
  if (!nextFollowUpAt) return { priority: 3, ts: Number.POSITIVE_INFINITY }

  const todayStart = startOfLocalDay(now)

  if (nextFollowUpAt.getTime() < todayStart.getTime()) {
    return { priority: 0, ts: nextFollowUpAt.getTime() }
  }

  if (isSameLocalDay(nextFollowUpAt, now)) {
    return { priority: 1, ts: nextFollowUpAt.getTime() }
  }

  return { priority: 2, ts: nextFollowUpAt.getTime() }
}

export default async function CoachDashboardPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  // 🔒 1) Vérifie session + onboarding
  const { user } = await requireOnboardingStep(3)

  // 🔒 2) Rôle coach obligatoire
  if ((user as any).role !== 'coach') {
    redirect('/hub')
  }

  // 🔒 3) Profil coach
  const coach = await prisma.coach.findFirst({
    where: { user_id: user.id },
  })

  if (!coach) {
    return (
      <main className="relative min-h-[100dvh] overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_30%,rgba(56,189,248,0.14),transparent_60%),radial-gradient(900px_500px_at_20%_80%,rgba(168,85,247,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70" />

        <div className="relative mx-auto flex min-h-[100dvh] max-w-3xl items-center justify-center px-6 py-12">
          <section className="w-full rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur">
            <h1 className="text-lg font-semibold">Profil coach non configuré</h1>
            <p className="mt-2 text-sm text-white/70">
              Ton compte a le rôle <strong>coach</strong>, mais aucun profil n&apos;est associé
              en base (table <code className="text-white/90">Coach</code>).
            </p>
            <p className="mt-3 text-xs text-white/60">
              Demande à un admin d&apos;associer ton <code className="text-white/90">user.id</code> à un
              enregistrement <code className="text-white/90">Coach</code> (avec <code className="text-white/90">slug</code>, nom, etc.).
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/hub"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white/90"
              >
                Retour hub
              </Link>
              <Link
                href="/messages"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Messagerie
              </Link>
            </div>
          </section>
        </div>
      </main>
    )
  }

  // 4) Filtres
  const statusFilterRaw = (sp.status ?? '').toUpperCase() 
  const allowedStatuses: CoachAthleteStatus[] = ['LEAD', 'ACTIVE', 'TO_FOLLOW', 'ENDED']

  const statusFilter: CoachAthleteStatus | null = allowedStatuses.includes(
    statusFilterRaw as CoachAthleteStatus,
  )
    ? (statusFilterRaw as CoachAthleteStatus)
    : null

    const q = (sp.q ?? '').toLowerCase().trim()

  // 5) Chargement messages + pipeline
  let messages: {
    id: string
    created_at: Date
    content: string | null
    coach_id: string | null
    user_id: string
    coach: {
      id: string
      slug: string
      name: string
      subtitle: string | null
      avatarInitial: string | null
    } | null
    user: {
      id: string
      email: string | null
      athleteProfile: {
        objectiveSummary: string | null
        goalType: string | null
      } | null
    } | null
  }[] = []

  let coachAthleteRows: {
    coach_id: string
    athlete_id: string
    status: CoachAthleteStatus
    labels: string[]
    nextFollowUpAt: Date | null
    pinned: boolean
  }[] = []

  try {
    const [messagesResult, coachAthletesResult] = await Promise.all([
      prisma.message.findMany({
        where: { coach_id: coach.id },
        include: {
          coach: {
            select: { id: true, slug: true, name: true, subtitle: true, avatarInitial: true },
          },
          user: {
            select: {
              id: true,
              email: true,
              athleteProfile: { select: { objectiveSummary: true, goalType: true } },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        take: 200,
      }),
      prisma.coachAthlete.findMany({
        where: { coach_id: coach.id },
        select: {
          coach_id: true,
          athlete_id: true,
          status: true,
          labels: true,
          nextFollowUpAt: true,
          pinned: true,
        },
      }),
    ])

    messages = messagesResult
    coachAthleteRows = coachAthletesResult
  } catch (err) {
    console.error('Erreur lors du chargement du dashboard coach :', err)
  }

  // 6) Pipeline map
  const pipelineByKey = new Map<
    ConversationKey,
    { status: CoachAthleteStatus | null; labels: string[]; nextFollowUpAt: Date | null; pinned: boolean }
  >()

  for (const row of coachAthleteRows) {
    const key: ConversationKey = `${row.coach_id}-${row.athlete_id}`
    pipelineByKey.set(key, {
      status: row.status ?? null,
      labels: row.labels ?? [],
      nextFollowUpAt: row.nextFollowUpAt ?? null,
      pinned: row.pinned ?? false,
    })
  }

  // 7) Regroupement conversations (coach_id + user_id)
  const conversationsByKey = new Map<ConversationKey, Conversation>()

  for (const m of messages) {
    if (!m.coach || !m.user) continue

    const key: ConversationKey = `${coach.id}-${m.user_id}`

    const userEmail: string = m.user.email ?? ''
    const userLabel: string = userEmail.split('@')[0] || `Athlète ${m.user.id.slice(0, 6)}`

    const profile = m.user.athleteProfile ?? null
    const pipeline = pipelineByKey.get(key)

    if (!conversationsByKey.has(key)) {
      conversationsByKey.set(key, {
        coachId: m.coach.id,
        coachSlug: m.coach.slug,
        coachName: m.coach.name,
        coachSubtitle: m.coach.subtitle ?? null,
        coachAvatarInitial: m.coach.avatarInitial ?? null,
        userId: m.user.id,
        userLabel,
        objectiveSummary: profile?.objectiveSummary ?? null,
        goalType: profile?.goalType ?? null,
        lastMessageAt: m.created_at,
        lastMessageContent: m.content ?? '',
        messageCount: 1,
        status: pipeline?.status ?? null,
        labels: pipeline?.labels ?? [],
        nextFollowUpAt: pipeline?.nextFollowUpAt ?? null,
        pinned: pipeline?.pinned ?? false,
      })
    } else {
      const conv = conversationsByKey.get(key)!
      conv.messageCount += 1

      if (m.created_at > conv.lastMessageAt) {
        conv.lastMessageAt = m.created_at
        conv.lastMessageContent = m.content ?? ''
      }
    }
  }

  // 8) Regroupement par coach
  const byCoach = new Map<
    string,
    { coachName: string; coachSubtitle: string | null; coachAvatarInitial: string | null; coachSlug: string; conversations: Conversation[] }
  >()

  for (const conv of conversationsByKey.values()) {
    if (!byCoach.has(conv.coachId)) {
      byCoach.set(conv.coachId, {
        coachName: conv.coachName,
        coachSubtitle: conv.coachSubtitle,
        coachAvatarInitial: conv.coachAvatarInitial,
        coachSlug: conv.coachSlug,
        conversations: [],
      })
    }
    byCoach.get(conv.coachId)!.conversations.push(conv)
  }

  const coachesDataRaw = Array.from(byCoach.values())
  const now = new Date()

  const coachesData = coachesDataRaw
    .map((c) => {
      let convs = c.conversations.slice()

      if (statusFilter) convs = convs.filter((conv) => conv.status === statusFilter)

      if (q) {
        convs = convs.filter((conv) => {
          const haystack = [conv.userLabel, conv.objectiveSummary ?? '', conv.goalType ?? '', conv.labels.join(' ')]
            .join(' ')
            .toLowerCase()
          return haystack.includes(q)
        })
      }

      convs.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1

        const fa = getFollowUpPriority(a.nextFollowUpAt, now)
        const fb = getFollowUpPriority(b.nextFollowUpAt, now)

        if (fa.priority !== fb.priority) return fa.priority - fb.priority
        if (fa.ts !== fb.ts) return fa.ts - fb.ts

        return b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
      })

      return { ...c, conversations: convs }
    })
    .filter((c) => c.conversations.length > 0)

  const hasData = coachesData.length > 0
  const hasAnyConversation = coachesDataRaw.some((c) => c.conversations.length > 0)
  const isFiltered = Boolean(statusFilter || q)

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      {/* fond */}
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_30%,rgba(56,189,248,0.14),transparent_60%),radial-gradient(900px_500px_at_20%_80%,rgba(168,85,247,0.12),transparent_60%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70" />

      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Espace coach
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Ton tableau de bord coach
            </h1>
            <p className="mt-2 text-sm text-white/70">
              Vue synthétique de tes athlètes, objectifs et derniers messages.
            </p>
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
              Ouvrir la messagerie
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Colonne principale */}
          <section className="rounded-3xl border border-white/10 bg-white/5 shadow-[0_25px_70px_rgba(0,0,0,0.35)] backdrop-blur">
            {/* Filtres */}
            <div className="border-b border-white/10 px-6 py-5">
              <form method="GET" className="flex flex-wrap items-center gap-3">
                <div className="flex flex-1 items-center gap-2">
                  <label htmlFor="search-q" className="text-xs font-medium text-white/70">
                    Rechercher
                  </label>
                  <input
                    id="search-q"
                    name="q"
                    type="text"
                    defaultValue={sp.q ?? ''}
                    placeholder="Athlète, objectif, tag..."
                    className="min-w-[220px] flex-1 rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="filter-status" className="text-xs font-medium text-white/70">
                    Statut
                  </label>
                  <select
                    id="filter-status"
                    name="status"
                    defaultValue={statusFilter ?? ''}
                    className="rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                  >
                    <option value="">Tous</option>
                    <option value="LEAD">Lead</option>
                    <option value="ACTIVE">Actif</option>
                    <option value="TO_FOLLOW">À relancer</option>
                    <option value="ENDED">Terminé</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white/90"
                >
                  Appliquer
                </button>

                {isFiltered && (
                  <Link
                    href="/coach"
                    className="text-xs font-medium text-white/60 underline underline-offset-2 hover:text-white/80"
                  >
                    Réinitialiser
                  </Link>
                )}
              </form>
            </div>

            {/* Liste */}
            <div className="space-y-6 px-6 py-5">
              {!hasAnyConversation && (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-sm text-white/70">
                  <p className="mb-1 font-semibold text-white/85">
                    Aucune conversation pour le moment.
                  </p>
                  <p className="text-xs text-white/60">
                    Dès que des athlètes t&apos;envoient des messages, tu verras ici leur liste.
                  </p>
                </div>
              )}

              {hasAnyConversation && !hasData && isFiltered && (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-5 text-sm text-amber-100">
                  <p className="mb-1 font-semibold">Aucun résultat pour ces filtres.</p>
                  <p className="text-xs text-amber-100/80">
                    Modifie la recherche ou réinitialise.
                  </p>
                </div>
              )}

              {coachesData.map((coachBlock) => (
                <div
                  key={coachBlock.coachSlug}
                  className="rounded-2xl border border-white/10 bg-black/15 p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                        {(coachBlock.coachAvatarInitial ?? coachBlock.coachName.charAt(0)).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {coachBlock.coachName}
                        </div>
                        {coachBlock.coachSubtitle && (
                          <div className="text-xs text-white/60">
                            {coachBlock.coachSubtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    <Link
                      href={`/messages?coachId=${coachBlock.coachSlug}`}
                      className="text-xs font-medium text-white/60 underline underline-offset-2 hover:text-white/80"
                    >
                      Ouvrir la messagerie
                    </Link>
                  </div>

                  <CoachConversationListClient
                    statusFilter={statusFilter}
                    q={q}
                    initialItems={coachBlock.conversations.map((conv) => ({
                      href: `/coach/athlete/${conv.userId}`,
                      athleteId: conv.userId,
                      coachSlug: coachBlock.coachSlug,
                      userLabel: conv.userLabel,
                      objectiveSummary: conv.objectiveSummary,
                      goalType: conv.goalType,
                      lastMessageAtIso: conv.lastMessageAt.toISOString(),
                      lastMessageContent: conv.lastMessageContent,
                      messageCount: conv.messageCount,
                      status: conv.status,
                      pinned: !!conv.pinned,
                      labels: conv.labels ?? [],
                      nextFollowUpAtIso: conv.nextFollowUpAt ? conv.nextFollowUpAt.toISOString() : null,
                    }))}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Sidebar hub */}
          <aside className="h-fit rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_70px_rgba(0,0,0,0.25)] backdrop-blur">
            <h2 className="text-lg font-semibold">Actions rapides</h2>

            <div className="mt-4 grid gap-3">
              <Link
                href="/coach/profile"
                className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-slate-950 hover:bg-white/90"
              >
                Compléter mon profil
              </Link>
              <Link
                href="/coach/documents"
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-white/10"
              >
                Uploader diplômes/certifs
              </Link>
              <Link
                href="/coach/tests"
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-white/10"
              >
                Tests & questionnaires
              </Link>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
              <div className="font-semibold text-white/85">Rappel</div>
              <p className="mt-2 text-xs text-white/60">
                Quand on démarre la partie “formulaires & tests”, on demandera une
                maquette Google Forms / Excel pour intégration.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
