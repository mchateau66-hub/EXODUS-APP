type Level = "info" | "warn" | "error";

/**
 * Logging sécurité (best-effort).
 *
 * Objectif :
 * - garder des traces côté serveur pour les événements sensibles (tokens invalides, stale entitlements, etc.)
 * - ne jamais throw (ne doit pas casser une route)
 *
 * Note :
 * - On reste volontairement minimal : console + payload borné.
 * - Si vous avez une table dédiée plus tard, ce module est le point d'intégration.
 */
export function logSecurity(event: string, meta: Record<string, unknown> = {}, level: Level = "warn") {
  try {
    const safe: Record<string, unknown> = { event };
    const keys = Object.keys(meta);
    for (const k of keys.slice(0, 40)) {
      const v = meta[k];
      // borne la taille des strings pour éviter les logs gigantesques
      safe[k] = typeof v === "string" ? v.slice(0, 500) : v;
    }

    if (level === "error") console.error("[security]", safe);
    else if (level === "info") console.log("[security]", safe);
    else console.warn("[security]", safe);
  } catch {
    // no-op
  }
}

