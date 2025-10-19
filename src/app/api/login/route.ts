import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { session?: string; maxAge?: number }
  const value = body.session || crypto.randomUUID()
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'

  const res = NextResponse.json({ ok: true, session: value })
  res.cookies.set({
    name: 'session',
    value,
    httpOnly: true,
    sameSite: 'lax',
    secure: proto === 'https',
    path: '/',
    maxAge: typeof body.maxAge === 'number' ? body.maxAge : 60 * 60 * 24 * 7,
  })
  return res
}
