import { put } from '@vercel/blob'
import { getUserFromSession } from '@/lib/auth'

export const runtime = 'nodejs'

const MAX_BYTES = 3 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

function extFromMime(mime: string) {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export async function POST(req: Request) {
  const ctx = await getUserFromSession()
  if (!ctx) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')

  if (!(file instanceof File)) return Response.json({ ok: false, error: 'Bad Request' }, { status: 400 })
  if (!ALLOWED.has(file.type)) return Response.json({ ok: false, error: 'Unsupported Media Type' }, { status: 415 })
  if (file.size > MAX_BYTES) return Response.json({ ok: false, error: 'Payload Too Large' }, { status: 413 })

  const ext = extFromMime(file.type)
  const pathname = `avatars/${ctx.user.id}/${Date.now()}.${ext}`

  const blob = await put(pathname, file, {
    access: 'public',
    addRandomSuffix: true,
    contentType: file.type,
  })

  return Response.json(
    { ok: true, url: blob.url },
    { headers: { 'cache-control': 'no-store' } }
  )
}
