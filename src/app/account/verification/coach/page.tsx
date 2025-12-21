import { redirect } from 'next/navigation'
import { requireOnboardingStep } from '@/lib/onboarding'
import CoachVerificationClient from './ui/CoachVerificationClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CoachVerificationPage() {
  const { user } = await requireOnboardingStep(3)
  if (String((user as any).role).toLowerCase() !== 'coach') redirect('/hub')

  return <CoachVerificationClient />
}
