import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIX = '/pro'

const SESSION_COOKIE_CANDIDATES = (
  process.env.SESSION_COOKIE_NAMES ?? 'sid,session'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const LOGIN_PATH = '/login'

export const config = {
  matcher: ['/pro/:path*'],
}

function hasSession(req: NextRequest): boolean {
  for (const name of SESSION_COOKIE_CANDIDATES) {
    const v = req.cookies.get(name)?.value
    if (v && v.trim() !== '') return true
  }

  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ') && auth.slice(7).trim() !== '') return true

  return false
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  // Ne jamais toucher /login, /api, /_next, /favicon...
  if (
    path.startsWith(LOGIN_PATH) ||
    path.startsWith('/api') ||
    path.startsWith('/_next') ||
    path.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Par sécurité, on ne protège que /pro
  if (!path.startsWith(PROTECTED_PREFIX)) {
    return NextResponse.next()
  }

  // Si session -> OK
  if (hasSession(req)) return NextResponse.next()

  // Sinon -> /login?next=...
  const url = req.nextUrl.clone()
  url.pathname = LOGIN_PATH
  url.searchParams.set('next', path)

  return NextResponse.redirect(url, { status: 307 })
}
