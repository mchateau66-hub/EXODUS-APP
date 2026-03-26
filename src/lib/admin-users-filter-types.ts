/**
 * Contrats de types partagés pour les filtres admin `/admin/users`.
 *
 * `AdminPremiumFilterMode` et `AdminBillingFilterMode` sont les formes normalisées après
 * `parseAdminUsersSearchParams` (chaîne vide = aucun filtre sur ce critère).
 *
 * Chaîne de données : `ParsedAdminUsersSearchParams` (`admin-users-search-params.ts`) →
 * `toAdminUsersSearchFilters` → `AdminUsersSearchFilters` (`admin-users-search-query.ts`) →
 * `buildAdminUsersWhere`.
 */
export type AdminPremiumFilterMode = "" | "with" | "without"

export type AdminBillingFilterMode = "" | "stripe" | "subscribed" | "canceling"
