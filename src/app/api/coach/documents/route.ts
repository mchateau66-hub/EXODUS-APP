import { put } from '@vercel/blob'
import { getUserFromSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

const MAX_BYTES = 15 * 1024 * 1024
const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

function sanitizeTitle(s: string) {
  return s.replace(/\s+/g, ' ').trim().slice(0, 120)
}
function safeKind(k: string) {
  const v = (k || '').toLowerCase()
  if (v === 'diploma' || v === 'certification' || v === 'other') return v
  return 'other'
}
function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, '_').slice(0, 80)
}

export async function GET() {
  const ctx = await getUserFromSession()
  if (!ctx) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const me = await prisma.user.findUnique({ where: { id: ctx.user.id } })
  if (!me) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (String(me.role).toLowerCase() !== 'coach')
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  const docs = await prisma.coachDocument.findMany({
    where: { user_id: me.id },
    orderBy: { created_at: 'desc' },
  })

  return Response.json({ ok: true, docs }, { headers: { 'cache-control': 'no-store' } })
}

export async function POST(req: Request) {
  const ctx = await getUserFromSession()
  if (!ctx) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const me = await prisma.user.findUnique({ where: { id: ctx.user.id } })
  if (!me) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  if (String(me.role).toLowerCase() !== 'coach')
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const kind = safeKind(String(form?.get('kind') || 'other'))
  const title = sanitizeTitle(String(form?.get('title') || ''))

  if (!(file instanceof File))
    return Response.json({ ok: false, error: 'Bad Request' }, { status: 400 })
  if (!ALLOWED.has(file.type))
    return Response.json({ ok: false, error: 'Unsupported Media Type' }, { status: 415 })
  if (file.size > MAX_BYTES)
    return Response.json({ ok: false, error: 'Payload Too Large' }, { status: 413 })

  const pathname = `coach-docs/${me.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`
  const blob = await put(pathname, file, {
    access: 'public',
    addRandomSuffix: true,
    contentType: file.type,
  })

  const doc = await prisma.coachDocument.create({
    data: {
      user_id: me.id,
      kind,
      title: title || null,
      url: blob.url,
      pathname: blob.pathname,
      mime_type: file.type,
      size_bytes: file.size,
      status: 'pending',
    },
  })

  return Response.json({ ok: true, doc }, { headers: { 'cache-control': 'no-store' } })
}
