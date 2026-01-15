import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import CreateAdClient from '../ui/CreateAdClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function onboardingRedirect(step: number | null | undefined) {
  const s = step ?? 0
  if (s < 1) return '/onboarding'
  if (s < 2) return '/onboarding/step-2'
  if (s < 3) return '/onboarding/step-3'
  return null
}

function getUserIdFromSession(sess: any): string | null {
  return (sess?.userId ?? sess?.id ?? sess?.user?.id ?? sess?.user?.userId) || null
}

export default async function NewAdPage() {
  const sess: any = await getUserFromSession()
  const userId = getUserIdFromSession(sess)
  if (!userId) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, onboardingStep: true, country: true, language: true },
  })
  if (!user) redirect('/login')

  const gate = onboardingRedirect(user.onboardingStep)
  if (gate) redirect(gate)

  // Only athletes can create ads
  if (String(user.role) !== 'athlete') redirect('/hub')

  const defaults = {
    country: user.country ?? 'FR',
    language: user.language ?? 'fr',
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Créer une annonce</h1>
      <p className="mt-2 text-sm text-slate-600">
        Décris ton objectif, ton sport et ce que tu attends d’un coach. Tu pourras l’afficher sur la map côté coach.
      </p>

      <div className="mt-6">
        <CreateAdClient defaults={defaults} />
      </div>
    </div>
  )
}
