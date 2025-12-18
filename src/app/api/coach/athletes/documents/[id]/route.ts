import { del } from '@vercel/blob'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getUserFromSession()
  if (!ctx) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const me = await prisma.user.findUnique({ where: { id: ctx.user.id } })
  if (!me) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const doc = await prisma.coachDocument.findUnique({ where: { id: params.id } })
  if (!doc) return Response.json({ ok: false, error: 'Not Found' }, { status: 404 })
  if (doc.user_id !== me.id) return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  await del(doc.pathname).catch(() => null)
  await prisma.coachDocument.delete({ where: { id: doc.id } })

  return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
}
