import type { FeatureKey } from "@/domain/billing/features";

/**
 * Helper pur (server-safe) utilisé par tous les chemins
 * (claim-based + session/DB-based) pour décider d'une feature.
 */
export function hasFeature(features: readonly string[], feature: FeatureKey | string): boolean {
  return features.includes(feature as string);
}

