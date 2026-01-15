import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'

import CreateAdClient from '../../ui/CreateAdClient'

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

export default async function EditAdPage({ params }: { params: { id: string } }) {
  const sess: any = await getUserFromSession()
  const userId = getUserIdFromSession(sess)
  if (!userId) redirect('/login?next=/hub')

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, onboardingStep: true, country: true, language: true },
  })
  if (!me) redirect('/login?next=/hub')

  const gate = onboardingRedirect(me.onboardingStep)
  if (gate) redirect(gate)

  if (String(me.role) !== 'athlete') redirect('/hub')

  const ad = await prisma.athleteAd.findFirst({
    where: { id: params.id, athlete_id: userId },
    select: {
      id: true,
      title: true,
      goal: true,
      sport: true,
      keywords: true,
      country: true,
      city: true,
      language: true,
      budget_min: true,
      budget_max: true,
      lat: true,
      lng: true,
      status: true,
      published_until: true,
    },
  })

  if (!ad) redirect('/hub')

  const defaults = {
    country: me.country ?? 'FR',
    language: me.language ?? 'fr',
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Annonce</p>
        <h1 className="text-2xl font-semibold">Modifier l’annonce</h1>
        <p className="mt-2 text-sm text-slate-600">
          Modifie ton annonce. Les coachs verront les changements sur la map.
        </p>
      </div>

      <CreateAdClient mode="edit" adId={ad.id} defaults={defaults} initial={ad} />
    </div>
  )
}
