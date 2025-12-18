// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'

// Chemin protégé (auth)
const PROTECTED_PREFIX = '/pro'

// Noms de cookies considérés comme "session"
const SESSION_COOKIE_CANDIDATES = (process.env.SESSION_COOKIE_NAMES ?? 'sid,session')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// Page de login
const LOGIN_PATH = '/login'

// ✅ Middleware global (pour appliquer CSP partout)
// On exclut _next, api, favicon/assets.
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

function buildCSP(nonce: string) {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://js.stripe.com`,
    "style-src 'self' 'unsafe-inline'",
    // ✅ ICI : on autorise Vercel Blob pour les avatars
    "img-src 'self' data: blob: https://*.stripe.com https://*.public.blob.vercel-storage.com",
    "connect-src 'self' https://api.stripe.com https://m.stripe.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "font-src 'self' data:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
  ]
  return directives.join('; ')
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  // 1) Prépare la réponse "next" + headers sécu
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const res = NextResponse.next({ request: { headers: new Headers(req.headers) } })

  // Tu peux conditionner avec CSP_STRICT=1 si tu veux
  // if (process.env.CSP_STRICT === '1') { ... }
  res.headers.set('Content-Security-Policy', buildCSP(nonce))
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('x-nonce', nonce)

  // 2) Ne jamais “protéger” /login (et routes techniques)
  if (
    path.startsWith(LOGIN_PATH) ||
    path.startsWith('/api') ||
    path.startsWith('/_next') ||
    path.startsWith('/favicon')
  ) {
    return res
  }

  // 3) Auth uniquement sur /pro/**
  if (!path.startsWith(PROTECTED_PREFIX)) {
    return res
  }

  if (hasSession(req)) return res

  // 4) Redirect vers /login (en gardant aussi les headers sécu)
  const url = req.nextUrl.clone()
  url.pathname = LOGIN_PATH
  url.searchParams.set('next', path)

  const redirectRes = NextResponse.redirect(url, { status: 307 })
  redirectRes.headers.set('Content-Security-Policy', buildCSP(nonce))
  redirectRes.headers.set('X-Frame-Options', 'DENY')
  redirectRes.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  redirectRes.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  redirectRes.headers.set('X-Content-Type-Options', 'nosniff')
  redirectRes.headers.set('x-nonce', nonce)
  return redirectRes
}
