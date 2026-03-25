import Link from "next/link"

export type AdminUserSearchResult = {
  id: string
  email: string | null
  name: string | null
  role: string
  status: string
  created_at: Date
  coachSlug: string | null
}

type AdminUsersResultsProps = {
  queryTrimmed: string
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

export function AdminUsersResults({ queryTrimmed, results, searchError }: AdminUsersResultsProps) {
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

  if (!queryTrimmed) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        Recherchez un utilisateur par e-mail, identifiant ou slug.
      </p>
    )
  }

  if (results.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        Aucun utilisateur trouvé pour cette recherche.
      </p>
    )
  }

  return (
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
  )
}
