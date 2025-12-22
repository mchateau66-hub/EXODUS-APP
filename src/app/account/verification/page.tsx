import { redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function VerificationIndexPage() {
  const ctx = await getUserFromSession()
  if (!ctx) redirect('/login?next=/account/verification')

  const me = await prisma.user.findUnique({ where: { id: ctx.user.id } })
  if (!me) redirect('/login?next=/account/verification')

  const role = String(me.role).toLowerCase()
  if (role === 'coach') redirect('/account/verification/coach')
  if (role === 'athlete') redirect('/account/verification/athlete')

  redirect('/account')
}
