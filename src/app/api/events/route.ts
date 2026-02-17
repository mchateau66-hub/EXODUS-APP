import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'
import type { Prisma } from "@prisma/client";

export const runtime = 'nodejs'

// ⚠️ garde l'enum open côté DB (String),
// mais on whitelist côté API pour éviter la pollution.
const EventName = z.enum([
  'hero_click',
  'pricing_click',
  'sticky_click',
  'finalcta_click',
  'signup_submit',
  // prêts pour phase Stripe
  'checkout_start',
  'checkout_success',
  'subscription_active',
  'subscription_canceled',
])

const BodySchema = z.object({
  sessionId: z.string().min(8).max(128),
  event: EventName,

  // segmentation (optionnel)
  role: z.enum(['coach', 'athlete', 'admin']).optional().nullable(),
  offer: z.string().max(64).optional().nullable(),
  billing: z.enum(['monthly', 'yearly']).optional().nullable(),

  // ts client optionnel (epoch ms) — sinon serveur
  ts: z.number().int().optional(),

  // meta technique uniquement (pas de PII)
  meta: z.unknown().optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return new Response('Bad Request', { status: 400 })

  const ctx = await getUserFromSession().catch(() => null)

  const ts = parsed.data.ts ? new Date(parsed.data.ts) : new Date()
  if (Number.isNaN(ts.getTime())) return new Response('Bad Request', { status: 400 })

  await prisma.event.create({
    data: {
      session_id: parsed.data.sessionId,
      user_id: ctx?.user.id ?? null,
      event: parsed.data.event,
      role: parsed.data.role ?? null,
      offer: parsed.data.offer ?? null,
      billing: parsed.data.billing ?? null,
      ts,
      meta: (parsed.data.meta ?? {}) as Prisma.InputJsonValue,
    },
  })

  return Response.json({ ok: true })
}
