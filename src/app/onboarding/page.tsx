// src/app/onboarding/page.tsx
import { redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth'
import CoachPersonaForm from './CoachPersonaForm'
import AthletePersonaForm from './AthletePersonaForm'

export const runtime = 'nodejs'

export default async function OnboardingPage() {
  const session = await getUserFromSession()
  if (!session) {
    redirect('/login?next=/onboarding')
  }

  const { user } = session
  const step = (user as any).onboardingStep ?? 0
  const role = (user as any).role as 'athlete' | 'coach'

  // 🟢 Onboarding terminé → redirection vers la "home métier"
  if (step >= 3) {
    redirect(role === 'coach' ? '/coach' : '/messages')
  }

  // 🟡 Étapes suivantes déjà entamées → on envoie vers la bonne page
  if (step === 1) {
    redirect('/onboarding/step-2')
  }

  if (step === 2) {
    redirect('/onboarding/step-3')
  }

  // 🔵 Étape 0 → formulaire d'identité / "rôle social"
  // (CoachPersonaForm / AthletePersonaForm)
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-2xl rounded-3xl bg-white shadow-xl border border-slate-200 px-6 py-6 sm:px-8 sm:py-8">
        {role === 'coach' ? <CoachPersonaForm /> : <AthletePersonaForm />}
      </section>
    </main>
  )
}
