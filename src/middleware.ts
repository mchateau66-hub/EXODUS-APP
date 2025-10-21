import { NextResponse, type NextRequest } from 'next/server'

export const config = { matcher: ['/pro/:path*'] }

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has('session')
  const auth = (req.headers.get('authorization') ?? '').toLowerCase()

  if (hasSession || auth.startsWith('bearer ')) {
    return NextResponse.next()
  }

  const url = new URL('/paywall', req.url)
  const from = req.nextUrl.pathname + req.nextUrl.search
  url.searchParams.set('from', from)

  const res = NextResponse.redirect(url, { status: 307 })
  res.headers.set('x-paywall', '1')
  return res
}
