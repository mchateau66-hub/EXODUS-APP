// src/app/api/login/route.ts
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

const DAY = 86400
const DEFAULT_TTL = parseInt(process.env.SESSION_TTL_S || String(7 * DAY), 10) // 7j
const MIN_TTL = 300                             // 5 min min
const MAX_TTL = 60 * DAY                        // 60 jours max

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { session?: string; maxAge?: number }
  const session = body.session || crypto.randomUUID()

  const requested = Number.isFinite(body.maxAge as number) ? Number(body.maxAge) : DEFAULT_TTL
  const ttl = clamp(requested, MIN_TTL, MAX_TTL)

  const expires = new Date(Date.now() + ttl * 1000).toUTCString()
  const cookie = [
    `session=${encodeURIComponent(session)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${ttl}`,
    `Expires=${expires}`,
  ].join('; ')

  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': cookie },
  })
}
