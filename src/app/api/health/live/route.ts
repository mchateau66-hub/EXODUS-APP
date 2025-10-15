export const runtime = 'nodejs'
export async function GET() {
  const body = { status: 'ok', now: new Date().toISOString(), version: process.env.APP_VERSION || 'dev' }
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
}
