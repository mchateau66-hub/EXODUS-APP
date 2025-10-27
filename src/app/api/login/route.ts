// src/app/api/login/route.ts
export async function POST() {
  const sid = `sid_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  const body = JSON.stringify({ ok: true });

  const headers = new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  // Local HTTP: pas de Domain, pas de Secure
  headers.append('set-cookie', `sid=${sid}; Path=/; HttpOnly; SameSite=Lax`);

  return new Response(body, { status: 200, headers });
}
