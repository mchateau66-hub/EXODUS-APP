// src/app/api/onboarding/step-1/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/onboarding/step-1
 * → Récupère les infos d'onboarding step 1 (identité / rôle social)
 *    + role + step courant.
 */
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
  const answers = (user as any).onboardingStep1Answers ?? null

  return NextResponse.json({
    ok: true,
    step,
    role,
    answers,
  })
}

/**
 * POST /api/onboarding/step-1
 * Body = JSON avec les réponses de l'étape 1 (identité / rôle social).
 *
 * Exemple de body côté front (coach) :
 * {
 *   "profileVisibility": "public",
 *   "socialRole": "Coach certifié en trail",
 *   "personaType": "coach_expert",
 *   "shortPublicTitle": "Spécialiste préparation trail"
 * }
 *
 * → Stocké tel quel dans user.onboardingStep1Answers (Json),
 *    et on marque onboardingStep >= 1.
 */
export async function POST(req: NextRequest) {
  const session = await getUserFromSession()
  if (!session) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 },
    )
  }

  const { user } = session

  const body = await req
    .json()
    .catch(() => null as unknown)

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_body',
        message:
          'Le corps de la requête doit être un objet JSON avec les réponses de l’étape 1.',
      },
      { status: 400 },
    )
  }

  const currentStep =
    typeof (user as any).onboardingStep === 'number'
      ? (user as any).onboardingStep
      : 0

  // On ne revient jamais en arrière : step >= 1 après cette étape.
  const nextStep = currentStep < 1 ? 1 : currentStep

  const updated = await prisma.user.update({
    where: { id: (user as any).id as string },
    data: {
      onboardingStep1Answers: body as any,
      onboardingStep: nextStep,
    },
    select: {
      id: true,
      role: true,
      onboardingStep: true,
      onboardingStep1Answers: true,
    },
  })

  const redirectTo =
    updated.onboardingStep >= 1 ? '/onboarding/step-2' : '/onboarding'

  return NextResponse.json({
    ok: true,
    step: updated.onboardingStep,
    role: updated.role,
    answers: updated.onboardingStep1Answers,
    next: redirectTo,
  })
}
