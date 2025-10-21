// src/app/api/logout/route.ts
export const runtime = 'nodejs'

function expireSessionCookie() {
  // Efface le cookie côté navigateur
  const parts = [
    'session=',
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ]
  return parts.join('; ')
}

export async function POST() {
  return new Response(null, {
    status: 204,
    headers: {
      'Set-Cookie': expireSessionCookie(),
    },
  })
}
