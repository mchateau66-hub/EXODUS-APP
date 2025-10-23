import { NextRequest, NextResponse } from 'next/server';

type PremiumOk = { ok: true };

export async function GET(
  req: NextRequest,
): Promise<NextResponse<PremiumOk>> {
  // Exemple d'accès aux query params sans any :
  const url = new URL(req.url);
  const from = url.searchParams.get('from') ?? undefined; // string | undefined

  // ... ta logique ici (aucun any)

  return NextResponse.json({ ok: true });
}
