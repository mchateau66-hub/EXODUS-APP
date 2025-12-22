// src/app/api/logout/route.ts
import { NextResponse, type NextRequest } from 'next/server'

async function getPrismaSafe() {
  try {
    const { PrismaClient } = await import('@prisma/client')
    return new PrismaClient()
  } catch (e) {
    console.error('Impossible de charger @prisma/client (logout)', e)
    return null
  }
}

export async function POST(req: NextRequest) {
  const sid = req.cookies.get('sid')?.value

  try {
    const prisma = await getPrismaSafe()
    if (prisma && sid) {
      try {
        await prisma.session.deleteMany({
          where: {
            // ✅ on utilise l'ID de session, pas “token”
            id: sid,
          },
        })
      } catch (e) {
        console.error('Erreur Prisma /api/logout deleteMany', e)
      }
    }
  } catch (e) {
    console.error('Erreur générale /api/logout', e)
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('sid', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })

  return res
}
