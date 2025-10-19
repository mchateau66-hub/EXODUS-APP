// middleware.ts
import { NextResponse, type NextRequest } from 'next/server'

// --- Configuration (inlinée au build) -------------------------------

// Chemin protégé (doit rester statique pour le matcher Next)
const PROTECTED_PREFIX = '/pro'

// Noms de cookies acceptés comme "session" (1er = par défaut)
const SESSION_COOKIE_CANDIDATES = (
  process.env.SESSION_COOKIE_NAMES ?? 'session'
)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

// Page de redirection du paywall
const PAYWALL_REDIRECT_TO = process.env.PAYWALL_REDIRECT_TO || '/'

// --------------------------------------------------------------------

export const config = {
  matcher: [`${PROTECTED_PREFIX}/:path*`],
}

function hasSession(req: NextRequest): boolean {
  // 1) Cookie(s)
  for (const name of SESSION_COOKIE_CANDIDATES) {
    const v = req.cookies.get(name)?.value
    if (v && v.trim() !== '') return true
  }

  // 2) (Optionnel) Authorization: Bearer <token>
  // Utile pour tests/outillage; si tu ne veux pas, commente ce bloc.
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ') && auth.slice(7).trim() !== '') return true

  return false
}

export function middleware(req: NextRequest) {
  if (hasSession(req)) return NextResponse.next()

  // Anonyme → paywall
  const url = req.nextUrl.clone()
  url.pathname = PAYWALL_REDIRECT_TO
  url.searchParams.set('paywall', '1')
  url.searchParams.set('from', req.nextUrl.pathname)

  const res = NextResponse.redirect(url, { status: 307 })
  // Petit indicateur utile au debug/tests
  res.headers.set('x-paywall', '1')
  return res
}
