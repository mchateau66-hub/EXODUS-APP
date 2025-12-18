// src/app/api/login/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { createSessionResponseForUser } from '@/lib/auth'
import { verifyPassword } from '@/lib/password'
import { err } from '@/lib/api-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LoginBody = {
  email?: string
  password?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as LoginBody

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email) return err('email_required', 400)
    if (!password) return err('password_required', 400)

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        status: true,
        passwordHash: true,
      },
    })

    // Sécurité : même réponse si email inconnu OU pas de hash
    if (!user || !user.passwordHash) return err('invalid_credentials', 401)

    if (user.status !== 'active') return err('account_disabled', 403)

    const okPwd = verifyPassword(password, user.passwordHash)
    if (!okPwd) return err('invalid_credentials', 401)

    // ✅ session + cookie sid (no-store est posé dans createSessionResponseForUser)
    return await createSessionResponseForUser(user.id, { ok: true })
  } catch (e) {
    console.error('Erreur in /api/login', e)
    return err('server_error', 500)
  }
}
