import { NextResponse } from 'next/server';

function getString(obj: unknown, key: string): string | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : undefined;
}

export async function POST(req: Request) {
  const raw: unknown = await req.json().catch(() => undefined);
  const plan: string | undefined = getString(raw, 'plan');
  return NextResponse.json({ ok: true, plan: plan ?? 'premium' });
}
