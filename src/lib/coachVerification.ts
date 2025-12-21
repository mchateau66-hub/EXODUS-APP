// src/lib/coachVerification.ts

/**
 * ✅ Nouveau standard (stable)
 */
export type CoachVerificationStatus =
  | "verified"
  | "needs_review"
  | "missing"
  | "rejected"
  | "unknown";

/**
 * Normalise les statuts DB (ou autres) vers un set stable côté UI.
 * Ajuste les alias si ta DB utilise d'autres valeurs.
 */
export function normalizeCoachVerificationStatus(
  raw?: string | null,
): CoachVerificationStatus {
  const s = (raw ?? "").toLowerCase().trim();
  if (!s) return "missing";

  // Validé / approuvé
  if (["verified", "approved", "accepted", "ok", "valid"].includes(s)) return "verified";

  // En cours / soumis / en attente de review
  if (
    ["needs_review", "pending", "submitted", "under_review", "in_review", "review"].includes(s)
  ) {
    return "needs_review";
  }

  // Manquant / non soumis
  if (["missing", "none", "not_submitted", "empty"].includes(s)) return "missing";

  // Rejeté
  if (["rejected", "refused", "denied", "declined"].includes(s)) return "rejected";

  return "unknown";
}

export function isCoachVerified(status: CoachVerificationStatus): boolean {
  return status === "verified";
}

/**
 * Plus petit = mieux classé (tri annuaire)
 * Décision produit : verified > needs_review > missing > unknown > rejected
 */
export function coachVerificationRank(status: CoachVerificationStatus): number {
  switch (status) {
    case "verified":
      return 0;
    case "needs_review":
      return 1;
    case "missing":
      return 2;
    case "unknown":
      return 3;
    case "rejected":
      return 4;
  }
}

export function coachVerificationCopy(
  status: CoachVerificationStatus,
): { label: string; hint?: string } {
  switch (status) {
    case "verified":
      return { label: "Vérifié" };
    case "needs_review":
      return { label: "En cours", hint: "Dossier soumis, vérification en attente." };
    case "missing":
      return { label: "Non vérifié", hint: "Le coach n’a pas finalisé sa vérification." };
    case "rejected":
      return { label: "Refusé", hint: "Vérification refusée." };
    default:
      return { label: "Inconnu", hint: "Statut de vérification non reconnu." };
  }
}

/**
 * 🧩 Compat legacy (pour éviter de casser /coachs/[slug] et autres fichiers)
 * Ces exports correspondent exactement à ceux que ton build réclame.
 */
export type CoachVerifyStatus =
  | "missing"
  | "pending"
  | "needs_review"
  | "verified"
  | "rejected"
  | "unknown";

/**
 * Agrège une liste de statuts de documents (multi-docs) en un seul statut.
 * - Si rejeté => needs_review (legacy) + on garde aussi 'rejected' possible si tu veux l’exploiter
 * - Si pending => pending
 * - Si needs_review => needs_review
 * - Si tout verified => verified
 * - Sinon => pending
 */
export function computeCoachVerification(statuses: string[]): CoachVerifyStatus {
  if (!statuses || statuses.length === 0) return "missing";

  const raw = statuses.map((s) => (s ?? "").toLowerCase().trim()).filter(Boolean);

  const hasNeedsReview = raw.includes("needs_review");
  const hasRejected = raw.includes("rejected");
  const hasPending = raw.includes("pending") || raw.includes("submitted") || raw.includes("under_review");
  const allVerified = raw.length > 0 && raw.every((s) => s === "verified");

  if (hasRejected) return "needs_review";
  if (hasNeedsReview) return "needs_review";
  if (hasPending) return "pending";
  if (allVerified) return "verified";
  return "pending";
}

/**
 * Legacy: badge simple (label + className) pour l’UI existante
 */
export function verifyBadge(
  s: CoachVerifyStatus,
): { label: string; className: string } {
  switch (s) {
    case "verified":
      return {
        label: "Vérifié",
        className: "bg-emerald-400/15 text-emerald-100 border-emerald-400/20",
      };
    case "pending":
      return {
        label: "En cours",
        className: "bg-sky-400/15 text-sky-100 border-sky-400/20",
      };
    case "missing":
      return {
        label: "Aucun doc",
        className: "bg-white/10 text-white/70 border-white/10",
      };
    case "needs_review":
      return {
        label: "À revoir",
        className: "bg-amber-400/15 text-amber-100 border-amber-400/20",
      };
    case "rejected":
      return {
        label: "Refusé",
        className: "bg-rose-400/15 text-rose-100 border-rose-400/20",
      };
    default:
      return {
        label: "Inconnu",
        className: "bg-white/10 text-white/70 border-white/10",
      };
  }
}

/**
 * Legacy: utile pour afficher un bandeau uniquement si non vérifié.
 * (Souvent utilisé comme condition JSX.)
 */
export function verifyBannerNonVerifiedOnly(s: CoachVerifyStatus): boolean {
  return s !== "verified";
}

/**
 * Optionnel legacy : si jamais un fichier l’utilise encore.
 * (Tri: verified > pending > needs_review > missing > unknown > rejected)
 */
export function verifyRank(s: CoachVerifyStatus): number {
  switch (s) {
    case "verified":
      return 0;
    case "pending":
      return 1;
    case "needs_review":
      return 2;
    case "missing":
      return 3;
    case "unknown":
      return 4;
    case "rejected":
      return 5;
  }
}
