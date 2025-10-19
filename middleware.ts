import { NextResponse, type NextRequest } from 'next/server'
export const config = { matcher: ['/pro/:path*'] }

function hasSession(req: NextRequest) {
  if (req.cookies.get('session')?.value) return true
  const a = req.headers.get('authorization')
  return !!(a?.startsWith('Bearer ') && a.slice(7).trim())
}

export function middleware(req: NextRequest) {
  if (hasSession(req)) return NextResponse.next()
  const url = req.nextUrl.clone()
  url.pathname = '/'
  url.searchParams.set('paywall', '1')
  url.searchParams.set('from', req.nextUrl.pathname)
  const res = NextResponse.redirect(url, { status: 307 })
  res.headers.set('x-paywall', '1')
  return res
}
