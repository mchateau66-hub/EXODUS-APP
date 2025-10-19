import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
// Répond toujours 200 pour le smoke test/CI
return NextResponse.json({ ok: true })
}