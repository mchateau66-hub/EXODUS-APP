// src/app/api/onboarding/step-2/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'

type Step2Body = {
  answers: Record<string, unknown>
}

export const runtime = 'nodejs'

function computeCoachQualificationScore(
  answers: Record<string, unknown>,
): number {
  const diploma = (answers.highestDiploma as string | undefined) ?? ''
  const experience = (answers.yearsExperience as string | undefined) ?? ''

  let score = 0

  // diplôme
  if (diploma.includes('Master STAPS')) score += 40
  else if (diploma.includes('Licence STAPS')) score += 30
  else if (diploma.includes('BPJEPS')) score += 25
  else if (diploma.includes('fédéral')) score += 20
  else if (diploma.includes('Aucun')) score += 0
  else if (diploma) score += 15

  // expérience
  if (experience === '0-2 ans') score += 5
  else if (experience === '3-5 ans') score += 15
  else if (experience === '6-10 ans') score += 25
  else if (experience === '10+ ans') score += 35

  // clamp
  if (score < 0) score = 0
  if (score > 100) score = 100

  return score
}

export async function POST(req: NextRequest) {
  const session = await getUserFromSession()
  if (!session) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 },
    )
  }

  const { user } = session
  const body = (await req.json().catch(() => null)) as Step2Body | null

  if (!body || !body.answers || typeof body.answers !== 'object') {
    return NextResponse.json(
      { ok: false, error: 'invalid_body' },
      { status: 400 },
    )
  }

  const role = (user as any).role as 'athlete' | 'coach'

  const data: any = {
    onboardingStep2Answers: body.answers,
    onboardingStep: 2,
  }

  if (role === 'coach') {
    data.coachQualificationScore = computeCoachQualificationScore(
      body.answers,
    )
  }

  await prisma.user.update({
    where: { id: user.id },
    data,
  })

  return NextResponse.json({ ok: true, nextStep: 3 })
}
