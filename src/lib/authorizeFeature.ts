/**
 * Autorisation premium centralisée.
 *
 * Contrat (hors SAT) : `authorizeFeature` décide d'accès premium en **un seul endroit** via une primitive
 * `hasFeature` (`src/lib/entitlements-core.ts`), avec deux stratégies explicites.
 *
 * - **bearer** :
 *   - entrée : `Authorization: Bearer <JWT>` (token **entitlements claim** émis par `/api/entitlements`)
 *   - vérification : `src/lib/entitlements-guard.ts` (HS256, TTL, `entitlements_version`, anti-replay JTI)
 *   - décision : `claim.features` (ou erreur si la feature n'est pas présente)
 *
 * - **session** :
 *   - entrée : cookie de session (résolution via `getUserFromSession`)
 *   - décision : features effectives en DB via la vue `user_effective_entitlements` (`getEffectiveFeatures`)
 *
 * - **SAT** :
 *   - non géré ici.
 *   - les routes qui nécessitent SAT continuent d'utiliser `consumeSAT` / `/api/sat` séparément.
 */

import { getUserFromSession } from "@/lib/auth";
import { getEffectiveFeatures } from "@/lib/entitlements.server";
import { HttpError } from "@/lib/http-error";
import { hasFeature as hasFeatureCore } from "@/lib/entitlements-core";
import type { FeatureKey } from "@/domain/billing/features";
import type { EntitlementClaim } from "@/lib/entitlements-guard";
import { verifyEntitlementClaimFreshAndConsumeJti } from "@/lib/entitlements-guard";
import { logSecurity } from "@/lib/security-log";
import { NextRequest } from "next/server";

export type AuthorizeFeatureMode = "bearer" | "session";

/**
 * Résultat de `authorizeFeature`.
 *
 * Contrat de stabilité :
 * - `mode` indique quelle stratégie a été utilisée.
 * - `userId` est toujours présent et correspond :
 *   - `"bearer"` : au `sub` du claim
 *   - `"session"` : à l’ID résolu via cookie session
 * - `features` est toujours présent et correspond à la source utilisée pour décider.
 * - `claim` et `planKey` ne sont fournis qu’en mode `"bearer"`.
 */
export type AuthorizeFeatureResult = {
  /**
   * Stratégie réellement utilisée.
   *
   * - `"bearer"` : décision à partir du JWT entitlements claim.
   * - `"session"` : décision à partir des features effectives DB.
   */
  mode: AuthorizeFeatureMode;

  /** ID utilisateur résolu (JWT `sub` ou userId DB). */
  userId: string;

  /**
   * Liste des features considérées “actives” pour le contrôle demandé.
   * - bearer : `claim.features`
   * - session : `getEffectiveFeatures(userId)`
   */
  features: string[];

  /**
   * Disponible uniquement en mode `"bearer"`.
   * La présence de ce champ signifie que le contrôle a été fait via un entitlements claim JWT.
   */
  claim?: EntitlementClaim;

  /**
   * Disponible uniquement en mode `"bearer"`.
   * Copie de `claim.planKey` (utile pour logs/UX).
   */
  planKey?: string;
};

export type AuthorizeFeatureOptions = {
  /** Obligatoire : `"bearer"` (JWT entitlements) ou `"session"` (cookie + DB). */
  mode: AuthorizeFeatureMode;
};

/**
 * Autorise une feature premium côté serveur.
 *
 * @throws HttpError (contrat d'erreur typé via `src/lib/http-error.ts`)
 * - mode `"bearer"` :
 *   - `401` avec `error` parmi : `missing_token`, `invalid_token`, `token_expired`,
 *     `token_iat_in_future`, `token_too_old`, `token_version_mismatch`, `replayed_token`,
 *     `server_misconfigured`
 *   - `403` : `feature_forbidden`
 *
 * - mode `"session"` :
 *   - `401` avec `error: "invalid_session"` si aucun cookie de session valide n'est présent
 *   - `403` : `feature_forbidden` si la feature n'est pas active en DB
 *
 * SAT : non supporté (les tokens SAT ne doivent pas être passés ici en mode bearer).
 */
export async function authorizeFeature(
  req: NextRequest,
  featureKey: FeatureKey | string,
  opts: AuthorizeFeatureOptions,
): Promise<AuthorizeFeatureResult> {
  const feature = featureKey as string;

  if (opts.mode === "bearer") {
    const claim = await verifyEntitlementClaimFreshAndConsumeJti(req);
    if (!hasFeatureCore(claim.features, feature)) {
      logSecurity("feature_forbidden", {
        userId: claim.sub,
        jti: claim.jti,
        featureKey: feature,
        planKey: claim.planKey,
      });
      throw new HttpError(403, "feature_forbidden", "feature_forbidden");
    }

    return {
      mode: "bearer",
      userId: claim.sub,
      features: claim.features,
      claim,
      planKey: claim.planKey,
    };
  }

  const session = await getUserFromSession().catch(() => null);
  const userId = String((session as { user?: { id?: unknown } } | null)?.user?.id ?? "");
  if (!userId) {
    throw new HttpError(401, "invalid_session", "invalid_session");
  }

  const features = await getEffectiveFeatures(userId);
  if (!hasFeatureCore(features, feature)) {
    logSecurity("feature_forbidden_session", { userId, featureKey: feature });
    throw new HttpError(403, "feature_forbidden", "feature_forbidden");
  }

  return {
    mode: "session",
    userId,
    features,
  };
}
