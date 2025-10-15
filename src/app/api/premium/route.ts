import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { verifySAT } from '@/lib/jwt'
export async function GET(req: NextRequest){
  const sat = req.headers.get('x-sat') || ''
  if (!sat) return new Response('missing SAT', { status: 401 })
  let p:any; try { p = await verifySAT(sat) } catch { return new Response('invalid SAT', { status: 401 }) }
  const rec = await prisma.sat.findUnique({ where: { jti: String(p.jti) }})
  if (!rec) return new Response('unknown jti', { status: 401 })
  if (rec.usedAt) return new Response('replay detected', { status: 401 })
  if (rec.expiresAt < new Date()) return new Response('expired', { status: 401 })
  await prisma.sat.update({ where: { jti: rec.jti }, data: { usedAt: new Date() } })
  return Response.json({ premium: true, message: 'Bienvenue VIP 🎟️', at: new Date().toISOString() })
}
