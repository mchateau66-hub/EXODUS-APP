// src/app/api/coach/athletes/[athleteId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import type { CoachAthleteStatus } from '@prisma/client'

type PatchBody = {
  coachSlug?: string // utile seulement pour admin
  status?: CoachAthleteStatus
  labels?: string[]
  nextFollowUpAt?: string | null
  pinned?: boolean
}

type SessionUserRole = 'athlete' | 'coach' | 'admin'
type SessionUser = { id: string; role: SessionUserRole }

function isSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== 'object') return false
  const v = value as { id?: unknown; role?: unknown }
  return (
    typeof v.id === 'string' &&
    (v.role === 'athlete' || v.role === 'coach' || v.role === 'admin')
  )
}

async function parseJson(req: NextRequest): Promise<PatchBody | null> {
  try {
    const raw: unknown = await req.json()
    if (!raw || typeof raw !== 'object') return {}
    return raw as PatchBody
  } catch {
    return null
  }
}

function normalizeLabels(labels: unknown): string[] | null {
  if (!Array.isArray(labels)) return null
  const cleaned = labels
    .filter((x) => typeof x === 'string')
    .map((s) => s.trim())
    .filter(Boolean)

  // unique + limite raisonnable
  const uniq = Array.from(new Set(cleaned)).slice(0, 12)
  return uniq
}

function parseIsoDateOrNull(value: unknown): Date | null | undefined {
  // undefined = pas de modification
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined

  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return undefined
  return d
}

const ALLOWED_STATUSES: CoachAthleteStatus[] = [
  'LEAD',
  'ACTIVE',
  'TO_FOLLOW',
  'ENDED',
]

export async function PATCH(
  req: NextRequest,
  { params }: { params: { athleteId: string } },
) {
  const sessionCtx = await getUserFromSession()

  if (!sessionCtx || typeof sessionCtx !== 'object' || !('user' in sessionCtx)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_session' },
      { status: 401 },
    )
  }

  const rawUser = (sessionCtx as { user?: unknown }).user
  if (!isSessionUser(rawUser)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_session' },
      { status: 401 },
    )
  }

  const actor = rawUser

  // 🔒 Autorisation
  if (actor.role !== 'coach' && actor.role !== 'admin') {
    return NextResponse.json(
      { ok: false, error: 'forbidden' },
      { status: 403 },
    )
  }

  const athleteId = params.athleteId

  const body = await parseJson(req)
  if (body === null) {
    return NextResponse.json(
      { ok: false, error: 'invalid_json' },
      { status: 400 },
    )
  }

  // 🔒 Résolution du coach cible
  let coachId: string | null = null

  if (actor.role === 'coach') {
    const coach = await prisma.coach.findFirst({
      where: { user_id: actor.id },
      select: { id: true },
    })

    if (!coach) {
      return NextResponse.json(
        { ok: false, error: 'coach_not_found' },
        { status: 404 },
      )
    }
    coachId = coach.id
  } else {
    // admin
    const coachSlug = typeof body.coachSlug === 'string' ? body.coachSlug.trim().toLowerCase() : ''
    if (!coachSlug) {
      return NextResponse.json(
        { ok: false, error: 'missing_coach_slug' },
        { status: 400 },
      )
    }

    const coach = await prisma.coach.findUnique({
      where: { slug: coachSlug },
      select: { id: true },
    })

    if (!coach) {
      return NextResponse.json(
        { ok: false, error: 'coach_not_found' },
        { status: 404 },
      )
    }
    coachId = coach.id
  }

  // ✅ Construction du patch data
  const data: {
    status?: CoachAthleteStatus
    labels?: string[]
    nextFollowUpAt?: Date | null
    pinned?: boolean
    lastMessageAt?: Date
  } = {}

  if (body.status && ALLOWED_STATUSES.includes(body.status)) {
    data.status = body.status
  }

  const labels = normalizeLabels(body.labels)
  if (labels) {
    data.labels = labels
  }

  if (typeof body.pinned === 'boolean') {
    data.pinned = body.pinned
  }

  const next = parseIsoDateOrNull(body.nextFollowUpAt)
  if (next !== undefined) {
    // undefined => pas modifié ; null => efface ; Date => set
    data.nextFollowUpAt = next
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { ok: false, error: 'nothing_to_update' },
      { status: 400 },
    )
  }

  try {
    const updated = await prisma.coachAthlete.upsert({
      where: {
        coach_id_athlete_id: {
          coach_id: coachId,
          athlete_id: athleteId,
        },
      },
      update: data,
      create: {
        coach_id: coachId,
        athlete_id: athleteId,
        status: data.status ?? 'LEAD',
        labels: data.labels ?? [],
        pinned: data.pinned ?? false,
        nextFollowUpAt: data.nextFollowUpAt ?? null,
      },
      include: {
        coach: {
          select: {
            id: true,
            slug: true,
            name: true,
            subtitle: true,
            avatarInitial: true,
          },
        },
      },
    })

    return NextResponse.json(
      { ok: true, item: updated },
      { status: 200 },
    )
  } catch (e) {
    console.error('Error in PATCH /api/coach/athletes/[athleteId]', e)
    return NextResponse.json(
      { ok: false, error: 'server_error' },
      { status: 500 },
    )
  }
}
