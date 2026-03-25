import type { Role, UserStatus } from "@prisma/client"

/** Libellés FR communs — formulaire admin utilisateurs & récap filtres. */
export const ADMIN_USER_ROLE_LABEL: Record<Role, string> = {
  coach: "Coach",
  athlete: "Athlète",
  admin: "Administrateur",
}

export const ADMIN_USER_STATUS_LABEL: Record<UserStatus, string> = {
  active: "Actif",
  disabled: "Désactivé",
  deleted: "Supprimé",
}
