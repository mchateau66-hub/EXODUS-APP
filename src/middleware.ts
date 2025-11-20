import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'session';
const PAYWALL_HEADER = 'x-paywall';

// Middleware sur toutes les pages (hors API/assets),
// puis on filtre nous-mêmes sur /pro.
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // On ne protège que /pro
  if (!pathname.startsWith('/pro')) {
    return NextResponse.next();
  }

  const hasSession = req.cookies.has(SESSION_COOKIE_NAME);
  const authHeader = (req.headers.get('authorization') ?? '').toLowerCase();

  // Utilisateur connecté (cookie) OU Authorization: Bearer <token>
  if (hasSession || authHeader.startsWith('bearer ')) {
    return NextResponse.next();
  }

  // Anonyme sur /pro → redirection vers le paywall
  const url = new URL('/paywall', req.url);
  const from = pathname + search;

  // Ordre des params pour matcher ce que les tests attendent
  url.searchParams.set('paywall', '1');
  url.searchParams.set('from', from);

  const res = NextResponse.redirect(url, { status: 307 });

  // Header utilisé par les helpers Playwright
  res.headers.set(PAYWALL_HEADER, '1');

  return res;
}
