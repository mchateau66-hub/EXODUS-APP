// src/app/api/onboarding/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
  const session = await getUserFromSession()
  if (!session) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 },
    )
  }

  const { user } = session
  const step = (user as any).onboardingStep ?? 0
  const role = (user as any).role ?? null

  return NextResponse.json({
    ok: true,
    step,
    role,
  })
}
