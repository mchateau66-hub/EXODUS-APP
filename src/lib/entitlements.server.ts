// src/lib/entitlements.server.ts
import { prisma } from "@/lib/db";

export async function getEffectiveFeatures(userId: string): Promise<string[]> {
  // View: user_effective_entitlements(user_id uuid, features text[])
  // NOTE: si la vue est absente, on renvoie [] plutôt que casser l'app.
  try {
    const rows = await prisma.$queryRaw<{ features: string[] }[]>`
      SELECT features
      FROM user_effective_entitlements
      WHERE user_id = ${userId}::uuid
      LIMIT 1
    `;
    const features = rows?.[0]?.features ?? [];
    return Array.isArray(features) ? features.map(String) : [];
  } catch {
    return [];
  }
}

export async function userHasFeature(userId: string, featureKey: string): Promise<boolean> {
  const features = await getEffectiveFeatures(userId);
  return features.includes(featureKey);
}
