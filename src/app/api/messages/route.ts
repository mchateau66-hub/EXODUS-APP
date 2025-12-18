// src/app/api/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { CoachAthleteStatus, Message, Prisma } from '@prisma/client'
import {
  userHasMessagesAccess,
  userHasUnlimitedMessages,
  coachHasUnlimitedAthletes,
  coachHasExternalAppLink,
} from '@/server/features'

// --------- Types de requêtes / réponses ---------

// même shape que côté front (UsageInfo)
type MessagesUsageInfo = {
  limit?: number | null
  remaining?: number | null
  unlimited?: boolean
}

// Meta explicite quota (utile pour UI)
type MessagesQuotaMeta = {
  hasUnlimited: boolean
  dailyLimit: number | null
  usedToday: number | null
  remainingToday: number | null
}

type MessagesGetCoachNotFoundResponse = {
  ok: true
  messages: []
  usage: MessagesUsageInfo | null
  meta: MessagesQuotaMeta | null
  whatsapp: null
  error: 'coach_not_found'
}

type MessagesGetSuccessResponse = {
  ok: true
  messages: Message[]
  usage: MessagesUsageInfo | null
  meta: MessagesQuotaMeta | null
  whatsapp: string | null
  error?: undefined
}

type MessagesGetErrorResponse = {
  ok: false
  error: 'invalid_session' | 'server_error'
}

type MessagesGetResponse =
  | MessagesGetSuccessResponse
  | MessagesGetCoachNotFoundResponse
  | MessagesGetErrorResponse

type MessagesPostSuccessResponse = {
  ok: true
  message: Message
  usage: MessagesUsageInfo | null
  meta: MessagesQuotaMeta | null
}

type MessagesPostErrorCode =
  | 'invalid_session'
  | 'missing_content'
  | 'messages_access_expired'
  | 'coach_not_found'
  | 'coach_athletes_limit'
  | 'quota_exceeded'
  | 'server_error'

type MessagesPostErrorScope = 'trial' | 'daily'

type MessagesPostErrorResponse = {
  ok: false
  error: MessagesPostErrorCode
  limit?: number
  scope?: MessagesPostErrorScope
  usage?: MessagesUsageInfo
  meta?: MessagesQuotaMeta | null
}

type MessagesPostResponse =
  | MessagesPostSuccessResponse
  | MessagesPostErrorResponse

type MessagesPostRequestBody = {
  content?: string
  coachId?: string
}

// --------- Helpers safe pour la session / body ---------

type SessionUserRole = 'athlete' | 'coach' | 'admin'

interface SessionUser {
  id: string
  role: SessionUserRole
}

function isSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== 'object') return false
  const maybe = value as { id?: unknown; role?: unknown }
  if (typeof maybe.id !== 'string' || typeof maybe.role !== 'string') {
    return false
  }

  return (
    maybe.role === 'athlete' ||
    maybe.role === 'coach' ||
    maybe.role === 'admin'
  )
}

/**
 * Récupère l'utilisateur de la session de manière typée,
 * en partant d'un `unknown` pour éviter les `any`.
 */
async function getSessionUser(): Promise<SessionUser | null> {
  const rawSession: unknown = await getUserFromSession()

  if (!rawSession || typeof rawSession !== 'object') {
    return null
  }

  if (!('user' in rawSession)) {
    return null
  }

  const maybeUser = (rawSession as { user?: unknown }).user

  if (!isSessionUser(maybeUser)) {
    return null
  }

  return maybeUser
}

/**
 * Parse le body JSON sans `any`, en partant d'un `unknown`.
 */
async function parseJsonBody<T>(req: NextRequest): Promise<T | null> {
  try {
    const raw: unknown = await req.json()

    if (!raw || typeof raw !== 'object') {
      return null
    }

    return raw as T
  } catch {
    return null
  }
}

// --- Anti-contournement pour le plan Free ---

// Email classique : toto@mail.com
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi

// Numéros de téléphone (format FR + général) : +33 6..., 06-12-34-56-78, etc.
const PHONE_REGEX = /(\+?\d[\d .\-()]{6,}\d)/g

// Liens / URL externes : https://..., www..., domaine.tld/...
const URL_REGEX =
  /((?:https?:\/\/|www\.)\S+|\b[a-z0-9.-]+\.(?:com|fr|net|io|gg|me|org|app|co|live|tv)\S*)/gi

// Handles explicites avec @ : @mon_pseudo
const AT_HANDLE_REGEX = /(^|\s)@([a-z0-9_.-]{3,})\b/gi

// Tags Discord : pseudo#1234
const DISCORD_TAG_REGEX = /\b([a-z0-9_.]{3,})#\d{4}\b/gi

// Mots-clés de réseaux sociaux
const SOCIAL_WORDS =
  '(?:instagram|insta|ig|snapchat|snap|facebook|fb|tiktok|tt|telegram|signal|whatsapp|wa|discord|dc|linkedin|x|twitter|reddit|messenger|skype)'

// Mots-clés de type "pseudo / identifiant / compte"
const HANDLE_CONTEXT_WORDS =
  '(?:pseudo|identifiant|username|user|handle|profil|compte|contact|id)'

// Contexte "réseau social + texte qui suit"
const SOCIAL_CONTEXT_REGEX = new RegExp(
  `\\b${SOCIAL_WORDS}\\b([^\\n\\r]{0,50})`,
  'gi',
)

// Contexte "pseudo / identifiant / compte / profil" + texte qui suit
const HANDLE_CONTEXT_REGEX = new RegExp(
  `\\b${HANDLE_CONTEXT_WORDS}\\b([^\\n\\r]{0,50})`,
  'gi',
)

// Lien WhatsApp paramétrable par coach (slug)
const COACH_WHATSAPP_LINKS: Record<string, string | undefined> = {
  marie: process.env.COACH_MARIE_WHATSAPP_LINK,
  lucas: process.env.COACH_LUCAS_WHATSAPP_LINK,
}

function maskHandleInContext(full: string, contextPart: string): string {
  const context = String(contextPart ?? '')
  const handleMatch = context.match(/@?[a-z0-9_.-]{3,}/i)
  if (!handleMatch) return full
  const handle = handleMatch[0]
  return full.replace(handle, '[pseudo masqué]')
}

function sanitizeMessageForFreePlan(raw: string): string {
  if (!raw) return raw

  const trimmed = raw.trim()

  // 🔒 Cas 0 : si le message ENTIER ressemble à un pseudo
  if (/^[a-z0-9][a-z0-9_.-]{4,}[a-z0-9]$/i.test(trimmed)) {
    return '[pseudo masqué]'
  }

  let text = raw

  // 1) Emails → [email masqué]
  text = text.replace(EMAIL_REGEX, '[email masqué]')

  // 2) Téléphones → [téléphone masqué]
  text = text.replace(PHONE_REGEX, '[téléphone masqué]')

  // 3) Liens / URL externes → [lien masqué]
  text = text.replace(URL_REGEX, '[lien masqué]')

  // 4) Contexte "instagram / snap / fb / ..." + pseudo derrière
  text = text.replace(
    SOCIAL_CONTEXT_REGEX,
    (full: string, ctx: string) => maskHandleInContext(full, ctx),
  )

  // 5) Contexte "pseudo / identifiant / compte / profil" + pseudo derrière
  text = text.replace(
    HANDLE_CONTEXT_REGEX,
    (full: string, ctx: string) => maskHandleInContext(full, ctx),
  )

  // 6) Handles explicites du type @mon_pseudo
  text = text.replace(AT_HANDLE_REGEX, (_full, space) => {
    return `${space}[pseudo masqué]`
  })

  // 7) Tags Discord "pseudo#1234"
  text = text.replace(DISCORD_TAG_REGEX, '[pseudo masqué]')

  // 8a) Fallback : mots qui ressemblent à un handle
  text = text.replace(
    /\b(?=[a-z0-9_.-]*[_\d.])[a-z0-9_.-]{5,}\b/gi,
    '[pseudo masqué]',
  )

  // 8b) Fallback : mots très longs tout en ascii
  text = text.replace(/\b[a-z0-9]{11,}\b/gi, '[pseudo masqué]')

  return text
}

// --- fin anti-contournement ---

export const dynamic = 'force-dynamic'

const FREE_DAILY_MESSAGES_LIMIT = Number(
  process.env.FREE_DAILY_MESSAGES_LIMIT ?? '20',
)

// Limite appliquée uniquement aux coachs Free
const COACH_FREE_ACTIVE_ATHLETES_LIMIT = Number(
  process.env.COACH_FREE_ACTIVE_ATHLETES_LIMIT ?? '5',
)

// Statuts considérés comme "actifs" pour le quota coach
const ACTIVE_COACH_ATHLETE_STATUSES: CoachAthleteStatus[] = [
  'LEAD',
  'ACTIVE',
  'TO_FOLLOW',
]

function getUtcDayStart(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
}

async function computeDailyQuota(
  userId: string,
  coachId: string | null,
  now: Date,
  hasUnlimited: boolean,
  preCount?: number | null,
): Promise<{ usage: MessagesUsageInfo; meta: MessagesQuotaMeta }> {
  if (hasUnlimited) {
    return {
      usage: { unlimited: true, limit: null, remaining: null },
      meta: {
        hasUnlimited: true,
        dailyLimit: null,
        usedToday: null,
        remainingToday: null,
      },
    }
  }

  const used =
    typeof preCount === 'number'
      ? preCount
      : await prisma.message.count({
          where: {
            user_id: userId,
            created_at: { gte: getUtcDayStart(now) },
            coach_id: coachId,
          },
        })

  const remaining = Math.max(0, FREE_DAILY_MESSAGES_LIMIT - used)

  return {
    usage: {
      unlimited: false,
      limit: FREE_DAILY_MESSAGES_LIMIT,
      remaining,
    },
    meta: {
      hasUnlimited: false,
      dailyLimit: FREE_DAILY_MESSAGES_LIMIT,
      usedToday: used,
      remainingToday: remaining,
    },
  }
}

/**
 * GET /api/messages
 *
 * ?coachId=marie|lucas (slug de Coach)
 *
 * - Retourne l'historique des messages pour l'athlète connecté
 * - Expose `usage` + `meta` pour la UI (quota / illimité)
 * - Expose `whatsapp` UNIQUEMENT si :
 *   - athlète Premium (messages.unlimited)
 *   - coach possède la feature coach.external_app_link (entitlement côté coach.user_id)
 *   - lien WhatsApp configuré en env pour ce coach
 */
export async function GET(
  req: NextRequest,
): Promise<NextResponse<MessagesGetResponse>> {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'invalid_session' },
      { status: 401 },
    )
  }

  const userId = user.id

  try {
    const url = new URL(req.url)
    const coachSlug = url.searchParams.get('coachId')?.toLowerCase() ?? null

    const where: Prisma.MessageWhereInput = {
      user_id: userId,
    }

    let coach: { id: string; user_id: string | null } | null = null

    if (coachSlug) {
      coach = await prisma.coach.findUnique({
        where: { slug: coachSlug },
        select: { id: true, user_id: true },
      })

      if (!coach) {
        console.warn('coach_not_found', { coachSlug })
        const response: MessagesGetCoachNotFoundResponse = {
          ok: true,
          messages: [],
          usage: null,
          meta: null,
          error: 'coach_not_found',
          whatsapp: null,
        }
        return NextResponse.json(response, { status: 200 })
      }

      where.coach_id = coach.id
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { created_at: 'asc' },
      take: 100,
    })

    const now = new Date()

    // 🔓 Premium / Free pour l'athlète
    const hasUnlimited = await userHasUnlimitedMessages(userId, now)

    // 📊 Usage + meta quota
    const { usage, meta } = await computeDailyQuota(
      userId,
      coach ? coach.id : null,
      now,
      hasUnlimited,
    )

    let whatsapp: string | null = null

    // WhatsApp UNIQUEMENT si athlète Premium + coach a l'entitlement + lien env
    if (hasUnlimited && coachSlug && coach) {
      const coachUserId = coach.user_id

      if (coachUserId) {
        const coachCanExposeLink = await coachHasExternalAppLink(coachUserId, now)

        if (coachCanExposeLink) {
          whatsapp = COACH_WHATSAPP_LINKS[coachSlug] ?? null
        }
      }
    }

    const response: MessagesGetSuccessResponse = {
      ok: true,
      messages,
      usage,
      meta,
      whatsapp,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error: unknown) {
    let message = 'Unknown error'
    if (error instanceof Error) {
      message = error.message
    } else if (typeof error === 'string') {
      message = error
    }

    console.error('Error in GET /api/messages:', message)

    const response: MessagesGetErrorResponse = {
      ok: false,
      error: 'server_error',
    }
    return NextResponse.json(response, { status: 500 })
  }
}

/**
 * POST /api/messages
 * body: { content: string, coachId?: string }  // coachId = slug ("marie", "lucas")
 *
 * - Vérifie l'accès messagerie via userHasMessagesAccess (unlimited OR free_trial)
 * - Applique le quota quotidien pour les non-Premium (par coach)
 * - Gère le pipeline CoachAthlete avec limite d'athlètes pour coach Free :
 *   - coachHasUnlimitedAthletes (entitlement sur coach.user_id)
 */
export async function POST(
  req: NextRequest,
): Promise<NextResponse<MessagesPostResponse>> {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'invalid_session' },
      { status: 401 },
    )
  }

  const userId = user.id

  const body = (await parseJsonBody<MessagesPostRequestBody>(req)) ?? {}

  const content = body.content?.trim() ?? ''
  const coachSlug = body.coachId ? body.coachId.toLowerCase() : null

  if (!content) {
    return NextResponse.json(
      { ok: false, error: 'missing_content' },
      { status: 400 },
    )
  }

  try {
    const now = new Date()

    // 1) Vérifier que l'utilisateur a le droit d'utiliser la messagerie
    const hasAccess = await userHasMessagesAccess(userId, now)

    if (!hasAccess) {
      const response: MessagesPostErrorResponse = {
        ok: false,
        error: 'messages_access_expired',
        scope: 'trial',
        usage: {
          unlimited: false,
          limit: null,
          remaining: null,
        },
        meta: null,
      }
      return NextResponse.json(response, { status: 402 })
    }

    let coachIdForDb: string | null = null
    let coachUserId: string | null = null

    if (coachSlug) {
      const coach = await prisma.coach.findUnique({
        where: { slug: coachSlug },
        select: { id: true, user_id: true },
      })

      if (!coach) {
        const response: MessagesPostErrorResponse = {
          ok: false,
          error: 'coach_not_found',
        }
        return NextResponse.json(response, { status: 404 })
      }

      coachIdForDb = coach.id
      coachUserId = coach.user_id

      // 🧠 Si c’est un ATHLÈTE qui parle à ce coach, on gère le pipeline CoachAthlete
      if (user.role === 'athlete') {
        // 🔑 Coach Premium : pas de limite d'athlètes (entitlement sur user_id)
        const isCoachUnlimited =
          coachUserId && (await coachHasUnlimitedAthletes(coachUserId, now))

        // Est-ce que cette relation coach-athlète existe déjà ?
        const existingRelation = await prisma.coachAthlete.findUnique({
          where: {
            coach_id_athlete_id: {
              coach_id: coach.id,
              athlete_id: userId,
            },
          },
          select: { coach_id: true },
        })

        // Nouveau lead pour ce coach et athlète, ET coach non Premium :
        // on applique la limite COACH_FREE_ACTIVE_ATHLETES_LIMIT
        if (!existingRelation && !isCoachUnlimited) {
          const activeCount = await prisma.coachAthlete.count({
            where: {
              coach_id: coach.id,
              status: { in: ACTIVE_COACH_ATHLETE_STATUSES },
            },
          })

          if (activeCount >= COACH_FREE_ACTIVE_ATHLETES_LIMIT) {
            const response: MessagesPostErrorResponse = {
              ok: false,
              error: 'coach_athletes_limit',
              limit: COACH_FREE_ACTIVE_ATHLETES_LIMIT,
            }
            return NextResponse.json(response, { status: 402 })
          }
        }

        // Upsert systématique de la relation CoachAthlete
        await prisma.coachAthlete.upsert({
          where: {
            coach_id_athlete_id: {
              coach_id: coach.id,
              athlete_id: userId,
            },
          },
          update: {
            lastMessageAt: now,
          },
          create: {
            coach_id: coach.id,
            athlete_id: userId,
            status: 'LEAD',
            lastMessageAt: now,
          },
        })
      }
    }

    // 3) Vérifier si l'utilisateur est Premium (messages illimités)
    const hasUnlimited = await userHasUnlimitedMessages(userId, now)

    // Si l'utilisateur n'est pas Premium, on applique le quota quotidien par coach
    let messagesCountToday: number | null = null

    if (!hasUnlimited) {
      const whereCount: Prisma.MessageWhereInput = {
        user_id: userId,
        created_at: { gte: getUtcDayStart(now) },
        coach_id: coachIdForDb ?? null,
      }

      messagesCountToday = await prisma.message.count({
        where: whereCount,
      })

      if (messagesCountToday >= FREE_DAILY_MESSAGES_LIMIT) {
        console.warn(
          `Quota messages atteint pour user=${userId}, coach=${coachIdForDb} (limite=${FREE_DAILY_MESSAGES_LIMIT})`,
        )

        const { usage, meta } = await computeDailyQuota(
          userId,
          coachIdForDb ?? null,
          now,
          false,
          messagesCountToday,
        )

        const response: MessagesPostErrorResponse = {
          ok: false,
          error: 'quota_exceeded',
          limit: FREE_DAILY_MESSAGES_LIMIT,
          scope: 'daily',
          usage,
          meta,
        }
        return NextResponse.json(response, { status: 402 })
      }
    }

    // 4) Anti-contournement en Free
    const finalContent = hasUnlimited ? content : sanitizeMessageForFreePlan(content)

    // 5) Création du message
    const message = await prisma.message.create({
      data: {
        user_id: userId,
        content: finalContent,
        coach_id: coachIdForDb,
      },
    })

    // 6) Recalcul / projection "usage" + "meta" après envoi pour le front
    const usedAfter = hasUnlimited ? null : (messagesCountToday ?? 0) + 1
    const { usage, meta } = await computeDailyQuota(
      userId,
      coachIdForDb ?? null,
      now,
      hasUnlimited,
      usedAfter,
    )

    const response: MessagesPostSuccessResponse = {
      ok: true,
      message,
      usage,
      meta,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error: unknown) {
    let message = 'Unknown error'
    if (error instanceof Error) {
      message = error.message
    } else if (typeof error === 'string') {
      message = error
    }

    console.error('Error in POST /api/messages:', message)

    const response: MessagesPostErrorResponse = {
      ok: false,
      error: 'server_error',
    }
    return NextResponse.json(response, { status: 500 })
  }
}
