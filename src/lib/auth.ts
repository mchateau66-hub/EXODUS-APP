// src/lib/auth.ts
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const SESSION_COOKIE_NAME = 'sid'

export type SessionContext = {
  user: any
  session: any
  sid: string
}

/**
 * Récupère l'utilisateur courant à partir du cookie "sid".
 * Retourne null s'il n'y a pas de session valide.
 */
export async function getUserFromSession(): Promise<SessionContext | null> {
  // Next 15 : cookies() est async
  const store = await cookies()

  const sid =
    store.get(SESSION_COOKIE_NAME)?.value ??
    store.get('session')?.value ?? // compat éventuelle
    null

  if (!sid) return null

  let session: any = null
  try {
    session = await prisma.session.findUnique({
      where: { id: sid },
      include: { user: true },
    })
  } catch {
    return null
  }

  if (!session || !session.user) return null

  return {
    user: session.user as any,
    session,
    sid,
  }
}

type SessionPayload = {
  ok: boolean
  redirectTo?: string
  checkoutUrl?: string
  [k: string]: unknown
}

/**
 * Crée une session pour le userId donné et renvoie une NextResponse.json(payload)
 * avec le cookie "sid" déjà posé.
 */
export async function createSessionResponseForUser(userId: string, payload: SessionPayload) {
  // 1) Créer la ligne de session en DB
  const session = await prisma.session.create({
    data: { user_id: userId },
  })

  // 2) Construire la réponse JSON
  const res = NextResponse.json(payload)

  // ✅ no-store centralisé ici
  res.headers.set('cache-control', 'no-store')

  // 3) Poser le cookie de session
  res.cookies.set(SESSION_COOKIE_NAME, session.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })

  return res
}
