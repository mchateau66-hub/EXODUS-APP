import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      status: 'up',
      uptime: process.uptime(),
      timestamp: Date.now()
    },
    { status: 200 }
  )
}
