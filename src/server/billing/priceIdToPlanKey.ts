import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Résout un Stripe Price ID vers un Plan.key.
 * Source de vérité = table Plan.
 * Retourne null si inconnu.
 */
export async function priceIdToPlanKey(priceId: string): Promise<string | null> {
  if (!priceId) return null;

  const plan = await prisma.plan.findFirst({
    where: {
      active: true,
      OR: [
        { stripe_price_id_monthly: priceId },
        { stripe_price_id_yearly: priceId },
      ],
    },
    select: { key: true },
  });

  return plan?.key ?? null;
}