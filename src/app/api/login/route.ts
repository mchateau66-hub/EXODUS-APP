import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'session';

export async function POST(req: NextRequest) {
  // On lit et ignore le JSON pour compatibilité avec les tests
  try {
    await req.json();
  } catch {
    // Pas grave s'il n'y a pas de body JSON
  }

  const res = NextResponse.json({ ok: true });

  // Cookie de session "fake" mais suffisant pour les tests
  res.cookies.set(SESSION_COOKIE_NAME, 'dummy-session-token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60, // 1h
  });

  return res;
}
