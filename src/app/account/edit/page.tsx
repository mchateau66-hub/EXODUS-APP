// src/app/account/edit/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import AccountProfileEditClient from './AccountProfileEditClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AccountEditPage() {
  const session = await getUserFromSession()
  if (!session) redirect('/login?next=/hub')

  const userId = session.user?.id
  if (!userId) redirect('/login?next=/hub')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingStep: true },
  })
  if (!user) redirect('/login?next=/hub')

  const onboardingStep = user.onboardingStep ?? 0

  if (onboardingStep < 1) redirect('/onboarding')
  if (onboardingStep < 2) redirect('/onboarding/step-2')
  if (onboardingStep < 3) redirect('/onboarding/step-3')

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-xs text-slate-500">Mon compte</p>
            <h1 className="text-sm font-semibold text-slate-900">Modifier mon profil</h1>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/account"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400"
            >
              Retour
            </Link>
            <Link
              href="/hub"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400"
            >
              Hub
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <AccountProfileEditClient />
      </div>
    </main>
  )
}
