import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function jsonNoStore(body: any, init?: ResponseInit) {
  const res = NextResponse.json(body, init)
  res.headers.set('cache-control', 'no-store')
  return res
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const ctx = await getUserFromSession()
  if (!ctx) return jsonNoStore({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 })

  const me = await prisma.user.findUnique({
    where: { id: ctx.user.id },
    select: { id: true, role: true, onboardingStep: true },
  })
  if (!me) return jsonNoStore({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 })
  if (String(me.role).toLowerCase() !== 'coach') {
    return jsonNoStore({ ok: false, error: 'FORBIDDEN' }, { status: 403 })
  }
  if ((me.onboardingStep ?? 0) < 3) {
    return jsonNoStore({ ok: false, error: 'ONBOARDING_INCOMPLETE' }, { status: 409 })
  }

  const id = String(params.id || '')
  if (!id) return jsonNoStore({ ok: false, error: 'INVALID_ID' }, { status: 400 })

  const doc = await prisma.coachDocument.findUnique({
    where: { id },
    select: { id: true, user_id: true },
  })
  if (!doc || doc.user_id !== me.id) {
    return jsonNoStore({ ok: false, error: 'NOT_FOUND' }, { status: 404 })
  }

  await prisma.coachDocument.delete({ where: { id } })
  return jsonNoStore({ ok: true })
}
