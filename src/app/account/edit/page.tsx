import { redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import AccountProfileEditClient from './AccountProfileEditClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AccountEditPage() {
  const session = await getUserFromSession()
  if (!session) redirect('/login?next=/account/edit')

  const userId = session.user?.id
  if (!userId) redirect('/login?next=/account/edit')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingStep: true },
  })

  if (!user) redirect('/login?next=/account/edit')

  const onboardingStep = user.onboardingStep ?? 0

  if (onboardingStep < 1) redirect('/onboarding')
  if (onboardingStep < 2) redirect('/onboarding/step-2')
  if (onboardingStep < 3) redirect('/onboarding/step-3')

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Profil
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Modifier mon profil
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Mets à jour tes informations personnelles et publiques pour améliorer
            ta présentation dans l’application.
          </p>
        </div>
      </section>

      <AccountProfileEditClient />
    </div>
  )
}