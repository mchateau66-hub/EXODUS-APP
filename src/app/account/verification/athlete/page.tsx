import { redirect } from 'next/navigation'
import { requireOnboardingStep } from '@/lib/onboarding'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AthleteVerificationPage() {
  const { user } = await requireOnboardingStep(3)

  if (String((user as any).role).toLowerCase() !== 'athlete') {
    redirect('/hub')
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Dossier athlète</h1>
        <p className="mt-1 text-sm text-slate-600">
          À venir : antécédents / consentement / documents optionnels.
        </p>
      </header>
    </main>
  )
}
