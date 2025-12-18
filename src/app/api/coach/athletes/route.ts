// src/app/api/coach/athletes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import type { CoachAthleteStatus, Prisma } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ApiError =
  | 'invalid_session'
  | 'forbidden'
  | 'coach_not_found'
  | 'server_error'

function isCoachAthleteStatus(
  value: string | null,
): value is CoachAthleteStatus {
  return (
    value === 'LEAD' ||
    value === 'ACTIVE' ||
    value === 'TO_FOLLOW' ||
    value === 'ENDED'
  )
}

export async function GET(req: NextRequest) {
  try {
    const sessionCtx = await getUserFromSession()

    if (!sessionCtx?.user) {
      return NextResponse.json(
        { ok: false, error: 'invalid_session' as ApiError },
        { status: 401 },
      )
    }

    const user = sessionCtx.user as {
      id: string
      role: 'coach' | 'athlete' | 'admin'
    }

    if (user.role !== 'coach') {
      return NextResponse.json(
        { ok: false, error: 'forbidden' as ApiError },
        { status: 403 },
      )
    }

    // On récupère le profil Coach lié à ce user
    const coach = await prisma.coach.findFirst({
      where: { user_id: user.id },
      select: { id: true },
    })

    if (!coach) {
      return NextResponse.json(
        { ok: false, error: 'coach_not_found' as ApiError },
        { status: 404 },
      )
    }

    const url = new URL(req.url)

    const statusRaw = url.searchParams.get('status')
    const statusParam = isCoachAthleteStatus(statusRaw) ? statusRaw : null

    const qRaw = url.searchParams.get('q')
    const q = qRaw && qRaw.trim().length > 0 ? qRaw.trim() : null

    const where: Prisma.CoachAthleteWhereInput = {
      coach_id: coach.id,
    }

    if (statusParam) {
      where.status = statusParam
    }

    if (q) {
      const query = q

      // Filtre sur l'athlète lié : email ou objectif dans AthleteProfile
      where.athlete = {
        OR: [
          {
            email: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            athleteProfile: {
              // relation 1-1 → on utilise `is`
              is: {
                OR: [
                  {
                    objectiveSummary: {
                      contains: query,
                      mode: 'insensitive',
                    },
                  },
                  {
                    goalType: {
                      contains: query,
                      mode: 'insensitive',
                    },
                  },
                  {
                    context: {
                      contains: query,
                      mode: 'insensitive',
                    },
                  },
                ],
              },
            },
          },
        ],
      }
    }

    const coachAthletes = await prisma.coachAthlete.findMany({
      where,
      orderBy: [
        { pinned: 'desc' },
        { status: 'asc' },
        { lastMessageAt: 'desc' },
      ],
      include: {
        athlete: {
          select: {
            id: true,
            email: true,
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
        },
      },
    })

    return NextResponse.json(
      { ok: true, items: coachAthletes },
      { status: 200 },
    )
  } catch (err) {
    console.error('Error in GET /api/coach/athletes', err)
    return NextResponse.json(
      { ok: false, error: 'server_error' as ApiError },
      { status: 500 },
    )
  }
}
