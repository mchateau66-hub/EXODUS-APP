import { NextRequest, NextResponse } from 'next/server';

type ProPayload = { email: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function isProPayload(v: unknown): v is ProPayload {
  return isRecord(v) && typeof v.email === 'string';
}

export async function POST(req: NextRequest) {
  const bodyUnknown = await req.json().catch(() => null) as unknown;

  if (!isProPayload(bodyUnknown)) {
    return NextResponse.json({ error: 'bad payload' }, { status: 400 });
  }

  const { email } = bodyUnknown;
  // … ton traitement …
  return NextResponse.json({ ok: true, email });
}
