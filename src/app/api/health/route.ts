// src/app/api/health/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  // Pas de logique compliquée ici : juste dire "OK"
  return NextResponse.json(
    {
      ok: true,
      status: 'healthy'
    },
    { status: 200 }
  )
}
