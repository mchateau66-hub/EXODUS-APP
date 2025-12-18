// src/app/api/sat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth';

// Réponse "par défaut" quand l'utilisateur n'a pas d'abonnement
function makeDefaultSatResponse() {
  return {
    pro: false,
    status: 'NONE',
    planKey: null as string | null,
    planName: null as string | null,
    expiresAt: null as Date | string | null,
    trialEndAt: null as Date | string | null,
  };
}

export async function GET(req: NextRequest) {
  try {
    // 1. On essaie de récupérer un userId depuis l'URL (?userId=...)
    const { searchParams } = new URL(req.url);
    let userId = searchParams.get('userId');

    // 2. Si pas de userId dans l'URL, on tombe en retour sur la session (cookie "sid")
    if (!userId) {
      const sessionCtx = await getUserFromSession().catch(() => null);
      if (sessionCtx?.user?.id) {
        userId = sessionCtx.user.id;
      }
    }

    // 3. Si on n'a toujours pas d'utilisateur => pas d'abonnement, pas "pro"
    if (!userId) {
      return NextResponse.json(makeDefaultSatResponse(), { status: 200 });
    }

    // 4. On va chercher le dernier entitlement de cet utilisateur
    const entitlement = await prisma.userEntitlement.findFirst({
      where: {
        user_id: userId,
      },
      include: {
        feature: true,
        subscription: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Pas d'entitlement ou pas de subscription associée => pas "pro"
    if (!entitlement || !entitlement.subscription) {
      return NextResponse.json(makeDefaultSatResponse(), { status: 200 });
    }

    const subscription = entitlement.subscription;

    const payload = {
      pro: subscription.status === 'active',
      status: subscription.status,
      planKey: subscription.plan_key,
      planName: subscription.plan?.name ?? null,
      expiresAt: subscription.expires_at ?? null,
      trialEndAt: subscription.trial_end_at ?? null,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error('Error in /api/sat', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
