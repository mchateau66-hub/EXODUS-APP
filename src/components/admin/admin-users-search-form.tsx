type AdminUsersSearchFormProps = {
  defaultQuery: string
}

/**
 * Formulaire GET vers `/admin/users` — lecture seule, pas de logique client.
 */
export function AdminUsersSearchForm({ defaultQuery }: AdminUsersSearchFormProps) {
  return (
    <form action="/admin/users" method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-0 flex-1">
        <label htmlFor="admin-users-q" className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
          Recherche
        </label>
        <input
          id="admin-users-q"
          name="q"
          type="search"
          autoComplete="off"
          defaultValue={defaultQuery}
          placeholder="Rechercher par e-mail, identifiant ou slug"
          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] shadow-[var(--card-shadow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border)]"
        />
      </div>
      <button
        type="submit"
        className="inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-fg)] shadow-sm transition-opacity hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border)]"
      >
        Rechercher
      </button>
    </form>
  )
}
