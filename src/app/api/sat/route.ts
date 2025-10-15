import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyEntitlements, signSAT } from '@/lib/jwt'
export async function POST(req: NextRequest){
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return new Response('missing entitlements', { status: 401 })
  let ent; try { ent = await verifyEntitlements(token) } catch { return new Response('invalid entitlements', { status: 401 }) }
  if (ent.plan !== 'premium') return new Response('forbidden (plan)', { status: 403 })
  const jti = crypto.randomUUID()
  const ttlSec = Number(process.env.SAT_TTL_S || 120)
  const now = new Date(), exp = new Date(now.getTime() + ttlSec*1000)
  await prisma.sat.create({ data:{ jti, userId:String(ent.sub), issuedAt:now, expiresAt:exp }})
  const sat = await signSAT({ sub:String(ent.sub), jti })
  return Response.json({ sat }, { headers: { 'cache-control': 'no-store' } })
}
