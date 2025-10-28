// src/app/api/logout/route.ts
export async function POST() {
  const headers = new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  // Supprime le cookie
  headers.append('set-cookie', `sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);

  return new Response(JSON.stringify({ ok: true }), { status: 204, headers });
}
