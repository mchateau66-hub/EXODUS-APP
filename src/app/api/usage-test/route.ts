// src/app/api/usage-test/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';
import { checkAndIncrementUsage, UsageLimitError } from '@/lib/usage';

const prisma = new PrismaClient();

/**
 * Route de test pour la limitation d'usage.
 *
 * GET /api/usage-test
 *
 * - lit le cookie "sid"
 * - retrouve l'utilisateur via la table Session
 * - applique une limite "free" sur la feature "messages"
 * - si l'utilisateur a l'entitlement "messages.unlimited", aucune limite
 */
export async function GET(req: NextRequest) {
  // ✅ Next 15 : cookies() est asynchrone
  const cookieStore = await cookies();
  const sid = cookieStore.get('sid')?.value ?? 'demo-session';

  // ❌ on ne filtre plus par expires_at (champ absent du modèle Session)
  const session = await prisma.session.findFirst({
    where: {
      id: sid,
    },
    include: {
      user: true,
    },
  });

  if (!session || !session.user) {
    return NextResponse.json(
      { ok: false, error: 'invalid_session' },
      { status: 401 },
    );
  }

  const userId = session.user.id;

  try {
    // 3) Vérifie la limite d’usage pour la feature "messages"
    const usage = await checkAndIncrementUsage({
      prisma,
      userId,
      featureKey: 'messages',
      freeLimit: 3,          // au lieu de 20
      unlimitedEntitlementKey: 'messages.unlimited',
    });    

    return NextResponse.json(
      {
        ok: true,
        feature: 'messages',
        usage,
      },
      { status: 200 },
    );
  } catch (e) {
    if (e instanceof UsageLimitError) {
      return NextResponse.json(
        {
          ok: false,
          error: 'limit_reached',
          feature: e.featureKey,
          message: 'Limite de messages atteinte pour cette période.',
        },
        { status: 403 },
      );
    }

    console.error('Erreur /api/usage-test', e);
    return NextResponse.json(
      { ok: false, error: 'server_error' },
      { status: 500 },
    );
  }
}
