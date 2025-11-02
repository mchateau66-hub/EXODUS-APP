import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  // ... tes vérifs / logique
  return NextResponse.json({ ok: true });
}
