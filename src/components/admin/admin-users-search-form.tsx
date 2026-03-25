import type { Role, UserStatus } from "@prisma/client"
import type { PlanKey } from "@/domain/billing/features"
import { ADMIN_USER_ROLE_LABEL, ADMIN_USER_STATUS_LABEL } from "@/components/admin/admin-users-labels"

type FeatureOption = { value: string; label: string }
type PlanOption = { value: PlanKey; label: string }

export type AdminPremiumFilterMode = "" | "with" | "without"

export type AdminBillingFilterMode = "" | "stripe" | "subscribed" | "canceling"

type AdminUsersSearchFormProps = {
  q: string
  role: string
  status: string
  feature: string
  premium: AdminPremiumFilterMode
  billing: AdminBillingFilterMode
  plan: string
  roleOptions: Role[]
  statusOptions: UserStatus[]
  featureOptions: readonly FeatureOption[]
  planOptions: readonly PlanOption[]
}

/**
 * Formulaire GET vers `/admin/users` — lecture seule, pas de logique client.
 */
export function AdminUsersSearchForm({
  q,
  role,
  status,
  feature,
  premium,
  billing,
  plan,
  roleOptions,
  statusOptions,
  featureOptions,
  planOptions,
}: AdminUsersSearchFormProps) {
  return (
    <form action="/admin/users" method="get" className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12 lg:items-end">
        <div className="min-w-0 md:col-span-2 lg:col-span-4">
          <label htmlFor="admin-users-q" className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
            Recherche
          </label>
          <input
            id="admin-users-q"
            name="q"
            type="search"
            autoComplete="off"
            defaultValue={q}
            placeholder="Rechercher par e-mail, identifiant ou slug"
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] shadow-[var(--card-shadow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border)]"
          />
        </div>

        <div className="min-w-0 lg:col-span-2">
          <label htmlFor="admin-users-role" className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
            Rôle
          </label>
          <select
            id="admin-users-role"
            name="role"
            defaultValue={role}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text)] shadow-[var(--card-shadow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border)]"
          >
            <option value="">Tous les rôles</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {ADMIN_USER_ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 lg:col-span-2">
          <label htmlFor="admin-users-status" className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
            Statut
          </label>
          <select
            id="admin-users-status"
            name="status"
            defaultValue={status}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text)] shadow-[var(--card-shadow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border)]"
          >
            <option value="">Tous les statuts</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {ADMIN_USER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 md:col-span-2 lg:col-span-3">
          <label htmlFor="admin-users-feature" className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
            Fonctionnalité premium
          </label>
          <select
            id="admin-users-feature"
            name="feature"
            defaultValue={feature}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text)] shadow-[var(--card-shadow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border)]"
          >
            <option value="">Toutes les fonctionnalités premium</option>
            {featureOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end md:col-span-2 lg:col-span-1">
          <button
            type="submit"
            className="inline-flex w-full min-w-[7rem] shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-fg)] shadow-sm transition-opacity hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border)] md:w-auto"
          >
            Rechercher
          </button>
        </div>

        <div className="min-w-0 md:col-span-1 lg:col-span-3">
          <label htmlFor="admin-users-premium" className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
            Offre premium
          </label>
          <select
            id="admin-users-premium"
            name="premium"
            defaultValue={premium}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text)] shadow-[var(--card-shadow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border)]"
          >
            <option value="">Tous les utilisateurs</option>
            <option value="with">Avec au moins une fonctionnalité premium</option>
            <option value="without">Sans fonctionnalité premium active</option>
          </select>
        </div>

        <div className="min-w-0 md:col-span-1 lg:col-span-3">
          <label htmlFor="admin-users-billing" className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
            Facturation Stripe
          </label>
          <select
            id="admin-users-billing"
            name="billing"
            defaultValue={billing}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text)] shadow-[var(--card-shadow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border)]"
          >
            <option value="">Tous les états</option>
            <option value="stripe">Avec client Stripe</option>
            <option value="subscribed">Abonnement actif, essai ou impayé léger</option>
            <option value="canceling">Résiliation à l’échéance</option>
          </select>
        </div>

        <div className="min-w-0 md:col-span-1 lg:col-span-3">
          <label htmlFor="admin-users-plan" className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
            Forfait Stripe
          </label>
          <select
            id="admin-users-plan"
            name="plan"
            defaultValue={plan}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text)] shadow-[var(--card-shadow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border)]"
          >
            <option value="">Tous les forfaits</option>
            {planOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </form>
  )
}
