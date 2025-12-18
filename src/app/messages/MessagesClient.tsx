'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Composer from '@/components/chat/Composer'
import { useAthleteProfile } from '@/lib/useAthleteProfile'

type Message = {
  id: string
  fromMe: boolean
  author: string
  text: string
  createdAt: string
}

type UsageInfo = {
  limit?: number | null
  remaining?: number | null
  unlimited?: boolean
}

type MessagesQuotaMeta = {
  hasUnlimited: boolean
  dailyLimit: number | null
  usedToday: number | null
  remainingToday: number | null
}

type CoachId = 'marie' | 'lucas'

type Coach = {
  id: CoachId
  name: string
  subtitle: string
  avatarInitial: string
}

type ApiMessage = {
  id?: string
  user_id?: string
  coach_id?: string | null
  content?: string
  text?: string
  created_at?: string
  createdAt?: string
}

type MessagesGetResponse = {
  ok: boolean
  messages?: ApiMessage[]
  usage?: UsageInfo | null
  meta?: MessagesQuotaMeta | null
  whatsapp?: string | null
  error?: string
  message?: string
}

type MessagesPostErrorScope = 'trial' | 'daily'

type MessagesPostResponse = {
  ok?: boolean
  message?: ApiMessage | string
  usage?: UsageInfo | null
  meta?: MessagesQuotaMeta | null
  limit?: number
  scope?: MessagesPostErrorScope
  error?: string
}

type CheckoutResponse = {
  ok: boolean
  url?: string
  id?: string
  error?: string
  message?: string
}

const COACHES: Coach[] = [
  {
    id: 'marie',
    name: 'Coach Marie',
    subtitle: 'Spécialiste préparation course & endurance',
    avatarInitial: 'M',
  },
  {
    id: 'lucas',
    name: 'Coach Lucas',
    subtitle: 'Spécialiste musculation & prise de masse',
    avatarInitial: 'L',
  },
]

const COACH_MESSAGES: Message[] = [
  {
    id: 'coach-1',
    fromMe: false,
    author: 'Coach',
    text: 'Bonjour ! Parle-moi de ton objectif principal.',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
]

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function isSameDay(a: string, b: string) {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

function formatDayLabel(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  })
}

function getErrorMessageFromApi(data: MessagesPostResponse | null): string | undefined {
  if (!data) return undefined
  if ('message' in data && typeof data.message === 'string') {
    return data.message
  }
  return data.error
}

// Type guard pour sécuriser coachId venant de l’URL
function isCoachId(value: string): value is CoachId {
  return COACHES.some((c) => c.id === value)
}

function pickRemainingToday(meta: MessagesQuotaMeta | null, usage: UsageInfo | null): number | null {
  if (meta && meta.hasUnlimited === false && typeof meta.remainingToday === 'number') {
    return meta.remainingToday
  }
  if (usage?.unlimited === false && typeof usage.remaining === 'number') {
    return usage.remaining
  }
  return null
}

function pickLimit(meta: MessagesQuotaMeta | null, usage: UsageInfo | null): number | null {
  if (meta && meta.hasUnlimited === false && typeof meta.dailyLimit === 'number') {
    return meta.dailyLimit
  }
  if (usage?.unlimited === false && typeof usage.limit === 'number') {
    return usage.limit
  }
  return null
}

function pickUsed(meta: MessagesQuotaMeta | null, usage: UsageInfo | null): number | null {
  if (meta && meta.hasUnlimited === false && typeof meta.usedToday === 'number') {
    return meta.usedToday
  }
  const limit = usage?.unlimited === false && typeof usage.limit === 'number' ? usage.limit : null
  const remaining =
    usage?.unlimited === false && typeof usage.remaining === 'number' ? usage.remaining : null

  if (typeof limit === 'number' && typeof remaining === 'number') {
    return Math.max(0, limit - remaining)
  }
  return null
}

export default function MessagesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [activeCoachId, setActiveCoachId] = useState<CoachId>('marie')

  // 🔒 Guard onboarding : on s'assure que l'utilisateur a fini au moins l'étape 3
  useEffect(() => {
    let cancelled = false

    async function checkOnboarding() {
      try {
        const res = await fetch('/api/onboarding/status', {
          method: 'GET',
          credentials: 'include',
        })

        const raw: unknown = await res.json().catch(() => null)
        const data: { ok?: boolean; step?: number; error?: string } | null =
          raw && typeof raw === 'object' ? (raw as any) : null

        if (
          res.status === 401 ||
          (data && data.ok === false && data.error === 'unauthorized')
        ) {
          if (!cancelled) router.push('/login?next=/messages')
          return
        }

        if (!data?.ok) return

        const step = typeof data.step === 'number' ? data.step : 0
        if (step >= 3 || cancelled) return

        if (step <= 0) router.push('/onboarding')
        else if (step === 1) router.push('/onboarding/step-2')
        else if (step === 2) router.push('/onboarding/step-3')
      } catch (err) {
        console.error('Erreur check onboarding status', err)
      }
    }

    void checkOnboarding()
    return () => {
      cancelled = true
    }
  }, [router])

  // Helper centralisé pour changer de coach + sync URL
  function selectCoach(coachId: CoachId) {
    setActiveCoachId(coachId)
    setCoachLimited(false)

    // sync URL sans recharger
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      params.set('coachId', coachId)
      router.push(`/messages?${params.toString()}`, { scroll: false })
    }
  }

  // Synchronisation avec ?coachId=
  useEffect(() => {
    const raw = searchParams.get('coachId')
    if (!raw) return
    const normalized = raw.toLowerCase()
    if (!isCoachId(normalized)) return
    if (normalized !== activeCoachId) setActiveCoachId(normalized)
  }, [searchParams, activeCoachId])

  const activeCoach = COACHES.find((c) => c.id === activeCoachId) ?? COACHES[0]

  const [messages, setMessages] = useState<Message[]>(COACH_MESSAGES)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [meta, setMeta] = useState<MessagesQuotaMeta | null>(null)

  const [limitError, setLimitError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)

  const [accessExpired, setAccessExpired] = useState(false)
  const [coachLimited, setCoachLimited] = useState(false)

  const [whatsappLink, setWhatsappLink] = useState<string | null>(null)

  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const { profile, loading: profileLoading } = useAthleteProfile()
  const displayedObjectiveSummary = profile?.objectiveSummary ?? null

  const listRef = useRef<HTMLDivElement | null>(null)

  const remainingToday = pickRemainingToday(meta, usage)
  const limit = pickLimit(meta, usage)
  const used = pickUsed(meta, usage)

  const isUnlimited = meta?.hasUnlimited === true || usage?.unlimited === true

  const limitReached =
    !!limitError || (typeof remainingToday === 'number' && remainingToday <= 0)

  const composerDisabled = limitReached || accessExpired || coachLimited

  const composerMode: 'default' | 'quota' | 'trial_expired' | 'coach_limit' =
    accessExpired
      ? 'trial_expired'
      : coachLimited
        ? 'coach_limit'
        : limitReached
          ? 'quota'
          : 'default'

  const upgradeHref = `/paywall?next=${encodeURIComponent(`/messages?coachId=${activeCoachId}`)}`

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const id = window.setTimeout(() => {
      el.scrollTop = el.scrollHeight
    }, 10)
    return () => window.clearTimeout(id)
  }, [messages.length, loadingHistory])

  // 🔁 Chargement de l'historique (par coach)
  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      setLoadingHistory(true)
      setLoadError(null)
      setWhatsappLink(null)
      setCheckoutError(null)
      setCheckoutLoading(false)

      setLimitError(null)
      setSendError(null)
      setAccessExpired(false)
      setCoachLimited(false)

      try {
        const res = await fetch(`/api/messages?coachId=${encodeURIComponent(activeCoachId)}`, {
          credentials: 'include',
        })

        if (res.status === 401) {
          router.push('/login?next=/messages')
          return
        }

        const raw: unknown = await res.json().catch(() => null)
        const data: MessagesGetResponse | null =
          raw && typeof raw === 'object' ? (raw as MessagesGetResponse) : null

        if (!res.ok || !data || data.ok === false) {
          if (!cancelled) {
            const msg = data?.message ?? data?.error ?? 'Erreur lors du chargement de vos messages.'
            setLoadError(msg)
            setWhatsappLink(null)
          }
          return
        }

        if (data.error === 'coach_not_found') {
          if (!cancelled) {
            setLoadError('Coach introuvable. Essaie un autre coach.')
            setMessages(COACH_MESSAGES)
            setUsage(null)
            setMeta(null)
            setWhatsappLink(null)
          }
          return
        }

        const history: ApiMessage[] = Array.isArray(data.messages) ? data.messages : []

        const historyMessages: Message[] = history.map((m) => {
          const createdAt = m.created_at ?? m.createdAt ?? new Date().toISOString()
          const text = m.content ?? m.text ?? ''
          const id = m.id ?? String(m.created_at ?? m.content ?? Math.random())
          return { id, fromMe: true, author: 'Moi', text, createdAt }
        })

        if (!cancelled) {
          setMessages([...COACH_MESSAGES, ...historyMessages])
          setUsage(data.usage ?? null)
          setMeta(data.meta ?? null)
          setWhatsappLink(data.whatsapp ?? null)
        }
      } catch (err: unknown) {
        console.error('Erreur GET /api/messages', err instanceof Error ? err : String(err))
        if (!cancelled) {
          setLoadError('Impossible de charger vos messages. Réessayez dans un instant.')
          setWhatsappLink(null)
        }
      } finally {
        if (!cancelled) setLoadingHistory(false)
      }
    }

    void loadHistory()
    return () => {
      cancelled = true
    }
  }, [activeCoachId, router])

  // Envoi d'un message
  async function handleSend({ text }: { text: string }): Promise<void> {
    if (!text.trim()) return

    setSendError(null)
    setLimitError(null)
    setAccessExpired(false)
    setCoachLimited(false)

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: text, coachId: activeCoachId }),
      })

      const raw: unknown = await res.json().catch(() => null)
      const data: MessagesPostResponse | null =
        raw && typeof raw === 'object' ? (raw as MessagesPostResponse) : null

      if (res.status === 401 || data?.error === 'invalid_session') {
        router.push('/login?next=/messages')
        return
      }

      if (typeof data?.usage !== 'undefined') setUsage(data.usage ?? null)
      if (typeof data?.meta !== 'undefined') setMeta(data.meta ?? null)

      if (res.status === 402 && data?.error === 'coach_athletes_limit') {
        setCoachLimited(true)
        setSendError(
          "Ce coach ne peut plus accepter de nouveaux athlètes avec son plan actuel. Choisis un autre coach pour continuer.",
        )
        return
      }

      if (res.status === 402 && data?.error === 'messages_access_expired') {
        setAccessExpired(true)
        setSendError("Ta période d’essai est terminée.")
        return
      }

      if (res.status === 402 && data?.error === 'quota_exceeded') {
        const fromApi =
          data && 'message' in data && typeof data.message === 'string'
            ? data.message
            : undefined

        const inferredLimit =
          typeof data?.limit === 'number'
            ? data.limit
            : typeof meta?.dailyLimit === 'number'
              ? meta.dailyLimit
              : typeof usage?.limit === 'number'
                ? usage.limit
                : null

        const msg =
          fromApi ??
          (typeof inferredLimit === 'number'
            ? `Vous avez atteint la limite de ${inferredLimit} messages pour aujourd’hui avec l’offre gratuite.`
            : 'Vous avez atteint la limite de messages pour cette période.')

        setLimitError(msg)
        return
      }

      if (!res.ok || data?.ok === false) {
        const msg = getErrorMessageFromApi(data)
        setSendError(msg ?? `Erreur lors de l'envoi du message (code ${res.status}).`)
        return
      }

      setLimitError(null)
      setCoachLimited(false)

      const serverMessage: ApiMessage | undefined =
        data && 'message' in data && typeof data.message === 'object'
          ? (data.message as ApiMessage)
          : undefined

      if (typeof data?.usage !== 'undefined') setUsage(data.usage ?? null)
      if (typeof data?.meta !== 'undefined') setMeta(data.meta ?? null)

      const messageText: string = serverMessage?.content ?? serverMessage?.text ?? text

      const newMessage: Message = {
        id: String(serverMessage?.id ?? generateId()),
        fromMe: true,
        author: 'Moi',
        text: messageText,
        createdAt: serverMessage?.created_at ?? serverMessage?.createdAt ?? new Date().toISOString(),
      }

      setMessages((prev) => [...prev, newMessage])
    } catch (err: unknown) {
      console.error('Erreur réseau /api/messages', err instanceof Error ? err : String(err))
      setSendError('Impossible de contacter le serveur. Réessayez.')
    }
  }

  // Checkout Stripe depuis la bannière quota
  async function handleStartCheckoutFromMessages(): Promise<void> {
    if (checkoutLoading) return
    setCheckoutError(null)
    setCheckoutLoading(true)

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''

      const successUrl = `${origin}/messages?coachId=${encodeURIComponent(
        activeCoachId,
      )}&checkout=success&plan=athlete_premium`
      const cancelUrl = `${origin}/messages?coachId=${encodeURIComponent(
        activeCoachId,
      )}&checkout=canceled&plan=athlete_premium`

      const res = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          planKey: 'athlete_premium',
          billingPeriod: 'monthly',
          successUrl,
          cancelUrl,
        }),
      })

      const raw: unknown = await res.json().catch(() => null)
      const data: CheckoutResponse | null =
        raw && typeof raw === 'object' ? (raw as CheckoutResponse) : null

      if (!res.ok || !data?.ok || typeof data.url !== 'string') {
        const msg =
          data?.message ??
          data?.error ??
          `Erreur lors de la création de la session de paiement (code ${res.status}).`
        setCheckoutError(msg)
        return
      }

      window.location.href = data.url
    } catch (err: unknown) {
      console.error(
        'Erreur /api/checkout/session depuis /messages',
        err instanceof Error ? err : String(err),
      )
      setCheckoutError("Impossible de démarrer le paiement pour le moment. Réessaie dans un instant.")
    } finally {
      setCheckoutLoading(false)
    }
  }

  const progressPct = (() => {
    if (isUnlimited) return 100
    const l = typeof limit === 'number' && limit > 0 ? limit : null
    const u = typeof used === 'number' && used >= 0 ? used : null
    if (!l || u === null) return 0
    const ratio = (u / l) * 100
    return Math.min(100, Math.max(0, ratio))
  })()

  const otherCoachId: CoachId = activeCoachId === 'marie' ? 'lucas' : 'marie'

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="flex h-[80vh] max-h-[720px] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
        <header className="border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur-sm sm:px-6">
          {/* Sélecteur de coach */}
          <div className="mb-3 flex flex-wrap gap-2">
            {COACHES.map((coach) => {
              const isActive = coach.id === activeCoachId
              return (
                <button
                  key={coach.id}
                  type="button"
                  onClick={() => selectCoach(coach.id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    isActive
                      ? 'border-slate-950 bg-slate-950 text-slate-50'
                      : 'border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                    {coach.avatarInitial}
                  </span>
                  <span>{coach.name}</span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Bloc coach + objectif */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {activeCoach.avatarInitial}
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900">{activeCoach.name}</div>
                <div className="mb-1 text-xs text-slate-500">{activeCoach.subtitle}</div>

                <div className="mt-2 max-w-xs rounded-2xl bg-slate-50 px-3 py-2 text-[11px] text-slate-900">
                  {profileLoading ? (
                    <span className="italic text-slate-400">Chargement de ton objectif…</span>
                  ) : displayedObjectiveSummary ? (
                    <>
                      <span className="block">{displayedObjectiveSummary}</span>
                      <Link
                        href="/onboarding"
                        className="mt-1 inline-block text-[11px] text-slate-600 underline underline-offset-2 hover:text-slate-800"
                      >
                        Modifier l&apos;objectif
                      </Link>
                    </>
                  ) : (
                    <>
                      <span className="block">
                        Tu n’as pas encore défini d’objectif précis avec le coach.
                      </span>
                      <Link
                        href="/onboarding"
                        className="mt-1 inline-block text-[11px] text-slate-600 underline underline-offset-2 hover:text-slate-800"
                      >
                        Définir ton objectif avec le coach
                      </Link>
                    </>
                  )}
                </div>

                <div className="mt-2">
                  <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>En ligne</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Statut & quota + bannières */}
            <div className="flex max-w-xs flex-col items-end gap-2 text-right">
              {(usage || meta) && (
                <div className="flex flex-col items-end gap-1">
                  <div className="text-[11px] text-slate-500">
                    {isUnlimited
                      ? 'Messages illimités'
                      : typeof remainingToday === 'number'
                        ? `${remainingToday} messages restants`
                        : 'Suivi des messages actif'}
                  </div>

                  <div className="flex w-32 items-center gap-2">
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full ${
                          isUnlimited ? 'bg-emerald-500' : 'bg-slate-900'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    <span className="text-[10px] text-slate-400">
                      {isUnlimited
                        ? '∞'
                        : typeof used === 'number' && typeof limit === 'number'
                          ? `${used}/${limit}`
                          : '—'}
                    </span>
                  </div>
                </div>
              )}

              {/* ✅ Nouvelle bannière coach limité + CTA changer */}
              {coachLimited && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  <p className="mb-1 font-semibold">
                    Ce coach a atteint sa limite d’athlètes (plan Free).
                  </p>
                  <p className="mb-2 opacity-90">Choisis un autre coach pour continuer.</p>

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => selectCoach(otherCoachId)}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-white hover:bg-slate-800"
                    >
                      Changer de coach
                    </button>

                    <Link
                      href="/coachs"
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-900 hover:bg-slate-50"
                    >
                      Voir tous les coachs
                    </Link>
                  </div>
                </div>
              )}

              {/* Bannière quota atteint (Free) */}
              {limitReached && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  <p className="mb-1">
                    Vous avez atteint la limite de messages du plan Free.
                    Passez sur l’offre Pro pour continuer à échanger sans limite avec votre coach.
                  </p>

                  <button
                    type="button"
                    onClick={() => void handleStartCheckoutFromMessages()}
                    disabled={checkoutLoading}
                    className="inline-flex items-center justify-center rounded-full bg-amber-800 px-3 py-1 text-[11px] font-medium text-amber-50 disabled:cursor-not-allowed disabled:bg-amber-400"
                  >
                    {checkoutLoading ? 'Redirection vers le paiement…' : 'Débloquer la messagerie illimitée'}
                  </button>

                  {checkoutError && <p className="mt-1 text-[10px] text-amber-900">{checkoutError}</p>}
                </div>
              )}

              {/* Bannière accès expiré (trial terminé) */}
              {accessExpired && (
                <div className="rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-[11px] text-red-800">
                  <p className="mb-1">
                    Ta période d’essai de la messagerie est terminée. Tu peux toujours lire l’historique,
                    mais l’envoi de nouveaux messages est réservé à l’offre Premium.
                  </p>
                  <a
                    href={upgradeHref}
                    className="inline-block rounded-full bg-red-700 px-3 py-1 text-[11px] font-medium text-red-50"
                  >
                    Découvrir l’offre Premium
                  </a>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* LISTE DES MESSAGES */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto bg-slate-50 px-4 py-3 text-[13px] sm:px-6 sm:py-4"
        >
          {loadingHistory && (
            <p className="mb-2 text-[11px] text-slate-500">Chargement de vos messages…</p>
          )}

          {loadError && <p className="mb-2 text-[11px] text-red-700">{loadError}</p>}

          {messages.length === 0 && !loadingHistory && !loadError && (
            <div className="mt-6 text-center text-xs text-slate-400">
              Aucun message pour le moment. Commence la discussion avec ton coach 👋
            </div>
          )}

          {messages.map((m, index) => {
            const isMe = m.fromMe
            const label = isMe ? 'Moi' : activeCoach.name

            const coachBubbleClasses =
              activeCoachId === 'marie'
                ? 'bg-sky-50 text-slate-900 border border-sky-100'
                : activeCoachId === 'lucas'
                  ? 'bg-emerald-50 text-slate-900 border border-emerald-100'
                  : 'bg-white text-slate-900 shadow-sm'

            const prev = messages[index - 1]
            const showDaySeparator = !prev || !isSameDay(prev.createdAt, m.createdAt)

            return (
              <div key={m.id}>
                {showDaySeparator && (
                  <div className="my-4 text-center text-[11px] font-medium text-slate-400">
                    {formatDayLabel(m.createdAt)}
                  </div>
                )}

                <div className={`mb-2 flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {!isMe && (
                    <div className="mr-2 mt-4 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">
                      {activeCoach.avatarInitial}
                    </div>
                  )}

                  <div
                    className={`
                      message-enter
                      max-w-[70%] rounded-2xl px-3 py-2 text-xs sm:px-4 sm:py-3
                      ${isMe ? 'bg-slate-900 text-slate-50' : coachBubbleClasses}
                    `}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span
                        className={`
                          text-[11px] font-semibold
                          ${isMe ? 'text-slate-200' : 'text-slate-500'}
                        `}
                      >
                        {label}
                      </span>
                      <span className="whitespace-nowrap text-[10px] text-slate-400">
                        {formatTime(m.createdAt)}
                      </span>
                    </div>
                    <p className="m-0 break-words text-[13px] leading-relaxed">{m.text}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {limitError && (
          <div className="px-4 pb-1 text-center text-[11px] text-amber-800 sm:px-6">
            {limitError}
          </div>
        )}

        {/* COMPOSER */}
        <div className="border-t border-slate-200 bg-white px-3 py-3 sm:px-4 sm:py-3">
          <Composer
            onSend={(payload) => void handleSend(payload)}
            disabled={composerDisabled}
            error={coachLimited ? sendError : sendError && !limitReached && !accessExpired ? sendError : null}
            mode={composerMode}
            quotaRemaining={typeof remainingToday === 'number' ? remainingToday : null}
            quotaLimit={typeof limit === 'number' ? limit : null}
            upgradeHref={upgradeHref}
          />

          {!isUnlimited && typeof remainingToday === 'number' && (
            <div className="mt-1 text-right text-[11px] text-slate-400">
              Il te reste{' '}
              <span className="font-semibold text-slate-600">{remainingToday}</span>{' '}
              message{remainingToday > 1 ? 's' : ''}
            </div>
          )}

          <div className="mt-2 flex flex-col items-start justify-between gap-2 text-[11px] text-slate-500 sm:flex-row sm:items-center">
            <p className="m-0">
              Pas d’email ni de téléphone en clair en plan Free. Les emails, numéros de téléphone
              et pseudos de réseaux sociaux sont masqués tant que vous n’avez pas débloqué la messagerie illimitée.
            </p>

            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-emerald-600 sm:mt-0"
              >
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-300" />
                Continuer la discussion sur WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
