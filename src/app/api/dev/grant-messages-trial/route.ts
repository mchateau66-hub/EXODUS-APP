// src/app/api/dev/grant-messages-trial/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { FEATURE_KEYS } from '@/domain/billing/features'
import { userHasFeature } from '@/server/features'

export const runtime = 'nodejs'

const TRIAL_DURATION_DAYS = 30

export async function POST(_req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { ok: false, error: 'not_found' },
      { status: 404 },
    )
  }

  const sessionCtx = await getUserFromSession()

  if (!sessionCtx?.user) {
    return NextResponse.json(
      { ok: false, error: 'invalid_session' },
      { status: 401 },
    )
  }

  const userId = sessionCtx.user.id
  const now = new Date()

  // Si l'utilisateur a déjà un trial actif, on ne recrée pas
  const hasActiveTrial = await userHasFeature(
    userId,
    FEATURE_KEYS.messagesFreeTrial,
    now,
  )

  if (hasActiveTrial) {
    return NextResponse.json(
      { ok: true, already: true },
      { status: 200 },
    )
  }

  const expiresAt = new Date(
    now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000,
  )

  await prisma.userEntitlement.create({
    data: {
      user_id: userId,
      feature_key: FEATURE_KEYS.messagesFreeTrial,
      source: 'admin', // grant créé côté dev
      subscription_id: null,
      starts_at: now,
      expires_at: expiresAt,
    },
  })

  return NextResponse.json(
    {
      ok: true,
      feature: FEATURE_KEYS.messagesFreeTrial,
      expires_at: expiresAt.toISOString(),
    },
    { status: 200 },
  )
}
