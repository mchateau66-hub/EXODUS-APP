import Link from "next/link"
import type { Role, UserStatus } from "@prisma/client"

export type AdminUserSearchResult = {
  id: string
  email: string | null
  name: string | null
  role: string
  status: string
  created_at: Date
  coachSlug: string | null
}

const ROLE_LABEL: Record<Role, string> = {
  coach: "Coach",
  athlete: "Athlète",
  admin: "Administrateur",
}

const STATUS_LABEL: Record<UserStatus, string> = {
  active: "Actif",
  disabled: "Désactivé",
  deleted: "Supprimé",
}

type AdminUsersResultsProps = {
  queryTrimmed: string
  appliedRole: Role | null
  appliedStatus: UserStatus | null
  hasActiveCriteria: boolean
  results: AdminUserSearchResult[]
  searchError: boolean
}

function formatCreatedAt(d: Date): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d)
  } catch {
    return d.toISOString()
  }
}

export function AdminUsersResults({
  queryTrimmed,
  appliedRole,
  appliedStatus,
  hasActiveCriteria,
  results,
  searchError,
}: AdminUsersResultsProps) {
  const filterChips: string[] = []
  if (appliedRole) filterChips.push(`rôle ${ROLE_LABEL[appliedRole]}`)
  if (appliedStatus) filterChips.push(`statut ${STATUS_LABEL[appliedStatus]}`)

  if (searchError) {
    return (
      <div
        className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-bg)] p-5 text-sm text-[var(--text)] shadow-[var(--card-shadow)]"
        role="alert"
      >
        Une erreur technique est survenue lors de la recherche. Réessayez dans un instant ou contactez l’équipe technique.
      </div>
    )
  }

  if (!hasActiveCriteria) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        Recherchez un utilisateur par e-mail, identifiant ou slug, ou appliquez un filtre par rôle ou statut.
      </p>
    )
  }

  if (results.length === 0) {
    return (
      <div className="space-y-2">
        {filterChips.length > 0 || queryTrimmed ? (
          <p className="text-xs text-[var(--text-muted)]">
            {filterChips.length > 0 ? <span>Filtres actifs : {filterChips.join(", ")}</span> : null}
            {filterChips.length > 0 && queryTrimmed ? <span className="mx-2 text-[var(--border)]">·</span> : null}
            {queryTrimmed ? <span>recherche « {queryTrimmed} »</span> : null}
          </p>
        ) : null}
        <p className="text-sm text-[var(--text-muted)]">
          Aucun utilisateur ne correspond aux critères sélectionnés.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {filterChips.length > 0 || queryTrimmed ? (
        <p className="text-xs text-[var(--text-muted)]">
          {filterChips.length > 0 ? <span>Filtres actifs : {filterChips.join(", ")}</span> : null}
          {filterChips.length > 0 && queryTrimmed ? <span className="mx-2 text-[var(--border)]">·</span> : null}
          {queryTrimmed ? <span>recherche « {queryTrimmed} »</span> : null}
        </p>
      ) : null}
      <ul className="space-y-3">
        {results.map((u) => (
          <li
            key={u.id}
            className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-bg)] p-4 shadow-[var(--card-shadow)] md:p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-semibold text-[var(--text)]">
                  {u.name?.trim() ? u.name : "Non renseigné"}
                </p>
                <p className="truncate text-sm text-[var(--text-muted)]">
                  {u.email?.trim() ? (
                    <span className="break-all">{u.email}</span>
                  ) : (
                    "Non renseigné"
                  )}
                </p>
                <p className="break-all font-mono text-xs text-[var(--text-muted)]">id: {u.id}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                  <span>
                    rôle: <span className="text-[var(--text)]">{u.role}</span>
                  </span>
                  <span>
                    statut: <span className="text-[var(--text)]">{u.status}</span>
                  </span>
                  <span>créé: {formatCreatedAt(u.created_at)}</span>
                  {u.coachSlug?.trim() ? (
                    <span>
                      slug coach: <span className="text-[var(--text)]">{u.coachSlug}</span>
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 sm:pt-0.5">
                <Link
                  href={`/admin/users/${u.id}`}
                  className="text-sm text-[var(--text-muted)] underline underline-offset-4 hover:underline focus-visible:rounded-[var(--radius-md)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border)]"
                >
                  Voir la fiche admin
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
