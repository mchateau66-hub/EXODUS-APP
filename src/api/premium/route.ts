import { NextRequest, NextResponse } from 'next/server';

function isPremiumRequest(_body: unknown): boolean {
  return true; // TODO: ta vraie validation
}

export async function POST(req: NextRequest) {
  const body: unknown = await req.json();

  if (!isPremiumRequest(body)) {
    return NextResponse.json({ error: 'bad payload' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
