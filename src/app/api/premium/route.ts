import { NextResponse, NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  // On lit le body si besoin (pour ne pas laisser un stream ouvert),
  // mais on ne le stocke pas tant qu'on ne s'en sert pas.
  await req.json()

  return NextResponse.json({ ok: true })
}
