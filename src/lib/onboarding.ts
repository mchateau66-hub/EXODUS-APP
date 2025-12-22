// src/lib/onboarding.ts
import { redirect } from 'next/navigation'
import { getUserFromSession, type SessionContext } from '@/lib/auth'

/**
 * Vérifie que l'utilisateur est loggé ET a atteint au moins `minStep`
 * dans l'onboarding. Sinon, redirige vers l'étape appropriée.
 *
 * Retourne le SessionContext si tout est OK.
 */
export async function requireOnboardingStep(
  minStep: number = 3,
): Promise<SessionContext> {
  const session = await getUserFromSession()

  if (!session) {
    redirect('/login')
  }

  const { user } = session
  const step = (user as any).onboardingStep ?? 0

  // Pas encore le niveau requis → on redirige dans le flow d'onboarding
  if (step < minStep) {
    if (step <= 0) {
      redirect('/onboarding')
    }
    if (step === 1) {
      redirect('/onboarding/step-2')
    }
    if (step === 2) {
      redirect('/onboarding/step-3')
    }

    // fallback au cas où
    redirect('/onboarding')
  }

  return session
}
