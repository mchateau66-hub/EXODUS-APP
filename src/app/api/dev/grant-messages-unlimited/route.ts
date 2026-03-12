import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { FEATURE_KEYS } from '@/domain/billing/features'
import { userHasUnlimitedMessages } from '@/server/features'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest) {
  // 🔒 On ne veut JAMAIS que cette route fonctionne en production
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

  // Si l'utilisateur a déjà l'entitlement, on ne recrée pas
  const alreadyHasUnlimited = await userHasUnlimitedMessages(userId, now)

  if (alreadyHasUnlimited) {
    return NextResponse.json(
      { ok: true, already: true },
      { status: 200 },
    )
  }

  await prisma.userEntitlement.create({
    data: {
      user_id: userId,
      feature_key: FEATURE_KEYS.messagesUnlimited,
      source: 'admin', // grant créé côté dev
      subscription_id: null, // pas lié à Stripe
      starts_at: now,
      expires_at: null, // illimité pour les tests
    },
  })

  // 🔐 VERY IMPORTANT: invalide tous les tokens d'entitlements existants
  await prisma.user.update({
    where: { id: userId },
    data: {
      entitlements_version: { increment: 1 },
    },
  })

  return NextResponse.json(
    { ok: true, feature: FEATURE_KEYS.messagesUnlimited },
    { status: 200 },
  )
}