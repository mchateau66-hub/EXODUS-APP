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

function isHttpUrl(u: string) {
  try {
    const url = new URL(u)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const ALLOWED_KINDS = new Set(['diploma', 'certification', 'other'])

export async function GET() {
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

  const docs = await prisma.coachDocument.findMany({
    where: { user_id: me.id },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      kind: true,
      title: true,
      url: true,
      pathname: true,
      mime_type: true,
      size_bytes: true,
      status: true,
      review_note: true,
      reviewed_at: true,
      created_at: true,
    },
  })

  return jsonNoStore({ ok: true, documents: docs })
}

export async function POST(req: Request) {
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

  const body = await req.json().catch(() => ({}))
  const kind = String(body?.kind ?? '')
  const title = body?.title ? String(body.title).slice(0, 120) : null
  const url = String(body?.url ?? '').trim()

  if (!ALLOWED_KINDS.has(kind)) {
    return jsonNoStore({ ok: false, error: 'INVALID_KIND' }, { status: 400 })
  }
  if (!url || !isHttpUrl(url)) {
    return jsonNoStore({ ok: false, error: 'INVALID_URL' }, { status: 400 })
  }

  let pathname = '/'
  try {
    pathname = new URL(url).pathname || '/'
  } catch {}

  const created = await prisma.coachDocument.create({
    data: {
      user_id: me.id,
      kind: kind as any,
      title,
      url,
      pathname,
      mime_type: String(body?.mime_type ?? 'application/octet-stream').slice(0, 120),
      size_bytes: Number.isFinite(Number(body?.size_bytes)) ? Number(body.size_bytes) : 0,
    },
    select: { id: true, kind: true, title: true, url: true, status: true, created_at: true },
  })

  return jsonNoStore({ ok: true, document: created }, { status: 201 })
}
