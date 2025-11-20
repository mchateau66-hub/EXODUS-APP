import { NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'session';

export async function POST() {
  // 204 No Content
  const res = new NextResponse(null, { status: 204 });

  // On supprime le cookie de session
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return res;
}
