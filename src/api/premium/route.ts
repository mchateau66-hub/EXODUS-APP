import { NextRequest, NextResponse } from 'next/server';

type PremiumOk = { ok: true };

export async function GET(_req: NextRequest): Promise<NextResponse<PremiumOk>> {
  // const url = new URL(_req.url);
  // const from = url.searchParams.get('from'); // <-- supprimer si non utilisé

  // ... ta logique

  return NextResponse.json({ ok: true });
}
