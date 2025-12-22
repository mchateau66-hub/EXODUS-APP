// src/lib/usage.ts
import type { PrismaClient } from '@prisma/client';

export class UsageLimitError extends Error {
  featureKey: string;

  constructor(featureKey: string) {
    super('Limite d’utilisation atteinte');
    this.name = 'UsageLimitError';
    this.featureKey = featureKey;
  }
}

/**
 * Calcule le début de la période courante pour UsageCounter.
 * Ici : 1er jour du mois en UTC (période mensuelle).
 */
function getCurrentPeriodStart(): Date {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  // 1er du mois à 00:00:00 UTC
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
}

/**
 * Vérifie la limite d’usage d’une feature et incrémente le compteur si c’est OK.
 *
 * - Si l’utilisateur a un entitlement "illimité" (ex: messages.unlimited) -> pas de limite, pas d’erreur.
 * - Sinon, on applique une limite "free" sur la période courante.
 *
 * Si la limite est dépassée → on lève UsageLimitError.
 */
export async function checkAndIncrementUsage(params: {
  prisma: PrismaClient;
  userId: string;
  /** clé de la feature à compter, ex: "messages" */
  featureKey: string;
  /** limite pour le plan gratuit, ex: 20 */
  freeLimit: number;
  /** clé d’entitlement qui donne l’illimité, ex: "messages.unlimited" */
  unlimitedEntitlementKey?: string;
}) {
  const { prisma, userId, featureKey, freeLimit, unlimitedEntitlementKey } =
    params;

  const now = new Date();

  // 1) Cas "illimité" via entitlements → on ne compte même pas
  if (unlimitedEntitlementKey) {
    const unlimited = await prisma.userEntitlement.findFirst({
      where: {
        user_id: userId,
        feature_key: unlimitedEntitlementKey,
      },
      select: {
        // on vérifie juste qu'il existe un entitlement actif
        user_id: true,
      },
    });

    if (unlimited) {
      return {
        limit: Infinity,
        remaining: Infinity,
        unlimited: true as const,
      };
    }
  }

  // 2) Sinon, on applique la limite "free" sur la période courante
  const period_start = getCurrentPeriodStart();

  // Composite ID défini dans ton modèle :
  // @@id([user_id, feature_key, period_start])
  const counter = await prisma.usageCounter.upsert({
    where: {
      user_id_feature_key_period_start: {
        user_id: userId,
        feature_key: featureKey,
        period_start,
      },
    },
    create: {
      user_id: userId,
      feature_key: featureKey,
      period_start,
      count: 0,
    },
    update: {}, // on ne touche pas encore au count ici
  });

  // déjà au plafond → on bloque
  if (counter.count >= freeLimit) {
    throw new UsageLimitError(featureKey);
  }

  // on incrémente le compteur
  const updated = await prisma.usageCounter.update({
    where: {
      user_id_feature_key_period_start: {
        user_id: userId,
        feature_key: featureKey,
        period_start,
      },
    },
    data: {
      count: { increment: 1 },
    },
  });

  return {
    limit: freeLimit,
    remaining: freeLimit - updated.count,
    unlimited: false as const,
  };
}
