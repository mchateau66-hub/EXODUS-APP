// src/app/api/onboarding/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
  const session = await getUserFromSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const { user, sid } = session as any
  const userId = user?.id ?? null

  const sessionStep = Number(user?.onboardingStep ?? 0)
  const safeSessionStep = Number.isFinite(sessionStep) ? sessionStep : 0
  const role = user?.role ?? null

  let dbStep: number | null = null
  if (userId) {
    const dbUser = await prisma.user
      .findUnique({ where: { id: userId }, select: { onboardingStep: true } })
      .catch(() => null)
    const raw = Number((dbUser as any)?.onboardingStep ?? 0)
    dbStep = Number.isFinite(raw) ? raw : 0
  }

  return NextResponse.json({
    ok: true,
    userId,
    sid,
    role,
    sessionStep: safeSessionStep,
    dbStep,
  })
}
