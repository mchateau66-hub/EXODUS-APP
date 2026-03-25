import type { SubStatus } from "@prisma/client"
import {
  SettingsFactRow,
  SettingsFactsList,
  SettingsInfoBox,
} from "@/components/account/settings/settings-section"

export type UserBillingVm = {
  stripeCustomerId: string | null
  hasStripeCustomer: boolean
  latestSubscription: {
    planName: string | null
    planKey: string | null
    status: SubStatus
    currentPeriodEnd: Date | null
    cancelAtPeriodEnd: boolean
    createdAt: Date
    updatedAt: Date
    stripeSubscriptionId: string
  } | null
}

export type UserUsagePanelProps = {
  email: string | null
  role: string | null
  status: string | null
  billing: UserBillingVm
  usage: {
    messagesSentToday: number | null
    messagesSentTotal: number | null
    coachProfileViews: number | null
    searchResultViews: number | null
    contactUnlocks: number | null
  }
  limits: {
    hasUnlimitedMessages: boolean
    messageDailyLimit: number | null
    messagesRemainingToday: number | null
    hasCoachPriorityListing: boolean
    hasProfileBoost: boolean
    hasSearchPriority: boolean
  }
  effectiveFeatures: string[]
}

function formatDateTimeFr(d: Date): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d)
  } catch {
    return d.toISOString()
  }
}

function subStatusLabelFr(s: SubStatus): string {
  const m: Record<SubStatus, string> = {
    incomplete: "Incomplet",
    trialing: "Période d’essai",
    active: "Actif",
    past_due: "Paiement en retard",
    canceled: "Résilié",
    unpaid: "Impayé",
  }
  return m[s] ?? s
}

function nOrDash(n: number | null): string {
  if (n === null) return "Non disponible"
  return String(n)
}

function unlimitedLabel(yes: boolean): string {
  return yes ? "Oui" : "Non"
}

function dailyLimitLabel(limits: UserUsagePanelProps["limits"]): string {
  if (limits.hasUnlimitedMessages) return "Illimitée"
  if (limits.messageDailyLimit === null) return "Non définie"
  return String(limits.messageDailyLimit)
}

function remainingLabel(limits: UserUsagePanelProps["limits"]): string {
  if (limits.hasUnlimitedMessages) return "Illimités"
  if (limits.messageDailyLimit === null) return "Non disponible"
  if (limits.messagesRemainingToday === null) return "Non disponible"
  return String(limits.messagesRemainingToday)
}

function priorityListingLabel(active: boolean): string {
  return active ? "Activée" : "Non activée"
}

function profileBoostLabel(active: boolean): string {
  return active ? "Activé" : "Non activé"
}

function searchPriorityLabel(active: boolean): string {
  return active ? "Activée" : "Non activée"
}

function planLabel(sub: NonNullable<UserBillingVm["latestSubscription"]>): string {
  const name = sub.planName?.trim()
  const key = sub.planKey?.trim()
  if (name && key) return `${name} (${key})`
  if (name) return name
  if (key) return key
  return "Aucun libellé de plan"
}

/**
 * Panneau lecture seule — usage, limites messages, entitlements effectifs (admin / support).
 */
export function UserUsagePanel({
  email,
  role,
  status,
  billing,
  usage,
  limits,
  effectiveFeatures,
}: UserUsagePanelProps) {
  const featuresSorted = [...effectiveFeatures].sort((a, b) => a.localeCompare(b))
  const sub = billing.latestSubscription

  const cancelEndLabel = !sub
    ? "Non disponible"
    : sub.cancelAtPeriodEnd
      ? "Oui"
      : "Non"

  const periodEndLabel =
    !sub ? "Non disponible" : sub.currentPeriodEnd ? formatDateTimeFr(sub.currentPeriodEnd) : "Non disponible"

  const statusLabel = !sub ? "Non disponible" : subStatusLabelFr(sub.status)

  return (
    <div className="space-y-6">
      <section
        className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-bg)] p-5 shadow-[var(--card-shadow)] md:p-6"
      >
        <h2 className="border-b border-[var(--border)] pb-3 text-base font-semibold tracking-tight text-[var(--text)]">
          Profil
        </h2>
        <div className="pt-5">
          <SettingsFactsList>
            <SettingsFactRow label="E-mail" value={email ? <span className="break-all">{email}</span> : "Non disponible"} />
            <SettingsFactRow label="Rôle" value={role ?? "Non disponible"} />
            <SettingsFactRow label="Statut du compte" value={status ?? "Non disponible"} />
          </SettingsFactsList>
        </div>
      </section>

      <section
        className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-bg)] p-5 shadow-[var(--card-shadow)] md:p-6"
      >
        <h2 className="border-b border-[var(--border)] pb-3 text-base font-semibold tracking-tight text-[var(--text)]">
          Abonnement et billing
        </h2>
        <div className="pt-5">
          <SettingsFactsList>
            <SettingsFactRow
              label="Client Stripe"
              value={billing.hasStripeCustomer ? "Oui" : "Non"}
            />
            <SettingsFactRow
              label="Stripe customer"
              value={
                billing.stripeCustomerId?.trim() ? (
                  <span className="break-all font-mono text-xs">{billing.stripeCustomerId}</span>
                ) : (
                  "Non disponible"
                )
              }
            />
            <SettingsFactRow
              label="Plan"
              value={sub ? planLabel(sub) : "Aucun abonnement"}
            />
            <SettingsFactRow label="Statut abonnement" value={statusLabel} />
            <SettingsFactRow label="Fin de période" value={periodEndLabel} />
            <SettingsFactRow label="Résiliation en fin de période" value={cancelEndLabel} />
            {sub ? (
              <>
                <SettingsFactRow label="Abonnement créé le" value={formatDateTimeFr(sub.createdAt)} />
                <SettingsFactRow label="Dernière mise à jour abonnement" value={formatDateTimeFr(sub.updatedAt)} />
                <SettingsFactRow
                  label="Identifiant abonnement Stripe"
                  value={<span className="break-all font-mono text-xs">{sub.stripeSubscriptionId}</span>}
                />
              </>
            ) : null}
          </SettingsFactsList>
          <SettingsInfoBox>
            Ce résumé reflète les données d’abonnement les plus récentes connues dans l’application et sert d’aide au
            support.
          </SettingsInfoBox>
        </div>
      </section>

      <section
        className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-bg)] p-5 shadow-[var(--card-shadow)] md:p-6"
      >
        <h2 className="border-b border-[var(--border)] pb-3 text-base font-semibold tracking-tight text-[var(--text)]">
          Usage
        </h2>
        <div className="pt-5">
          <SettingsFactsList>
            <SettingsFactRow label="Messages envoyés aujourd’hui" value={nOrDash(usage.messagesSentToday)} />
            <SettingsFactRow label="Messages envoyés au total" value={nOrDash(usage.messagesSentTotal)} />
            <SettingsFactRow label="Profils coach consultés" value={nOrDash(usage.coachProfileViews)} />
            <SettingsFactRow label="Résultats de recherche consultés" value={nOrDash(usage.searchResultViews)} />
            <SettingsFactRow label="Contacts débloqués" value={nOrDash(usage.contactUnlocks)} />
          </SettingsFactsList>
        </div>
      </section>

      <section
        className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-bg)] p-5 shadow-[var(--card-shadow)] md:p-6"
      >
        <h2 className="border-b border-[var(--border)] pb-3 text-base font-semibold tracking-tight text-[var(--text)]">
          Limites messages
        </h2>
        <div className="pt-5">
          <SettingsFactsList>
            <SettingsFactRow label="Messages illimités" value={unlimitedLabel(limits.hasUnlimitedMessages)} />
            <SettingsFactRow label="Limite quotidienne" value={dailyLimitLabel(limits)} />
            <SettingsFactRow label="Restant aujourd’hui" value={remainingLabel(limits)} />
          </SettingsFactsList>
          <SettingsInfoBox>
            Compteurs journaliers en UTC. La limite quotidienne s’applique via l’entitlement{" "}
            <span className="font-mono text-xs">messages.daily_limit</span> lorsqu’elle est définie, sauf si{" "}
            <span className="font-mono text-xs">messages.unlimited</span> est actif.
          </SettingsInfoBox>
        </div>
      </section>

      <section
        className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-bg)] p-5 shadow-[var(--card-shadow)] md:p-6"
      >
        <h2 className="border-b border-[var(--border)] pb-3 text-base font-semibold tracking-tight text-[var(--text)]">
          Découverte (Hub)
        </h2>
        <div className="pt-5">
          <SettingsFactsList>
            <SettingsFactRow
              label="Mise en avant du profil coach"
              value={priorityListingLabel(limits.hasCoachPriorityListing)}
            />
            <SettingsFactRow label="Boost du profil" value={profileBoostLabel(limits.hasProfileBoost)} />
            <SettingsFactRow
              label="Priorité dans les résultats de recherche"
              value={searchPriorityLabel(limits.hasSearchPriority)}
            />
          </SettingsFactsList>
          <SettingsInfoBox>
            La priorité de recherche constitue une priorisation dédiée aux résultats de recherche du Hub.
          </SettingsInfoBox>
          <SettingsInfoBox>
            Cette fonctionnalité permet de prioriser votre profil dans les résultats du Hub. La mise en avant applique une
            priorisation dans les résultats, sans garantir une position absolue.
          </SettingsInfoBox>
          <SettingsInfoBox>
            Cette fonctionnalité améliore la visibilité de votre profil dans les résultats du Hub. Le boost du profil
            constitue une priorisation secondaire dans le Hub.
          </SettingsInfoBox>
        </div>
      </section>

      <section
        className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-bg)] p-5 shadow-[var(--card-shadow)] md:p-6"
      >
        <h2 className="border-b border-[var(--border)] pb-3 text-base font-semibold tracking-tight text-[var(--text)]">
          Entitlements effectifs
        </h2>
        <div className="pt-5">
          {featuresSorted.length > 0 ? (
            <ul className="list-inside list-disc space-y-1.5 text-sm text-[var(--text)]">
              {featuresSorted.map((f) => (
                <li key={f} className="break-all font-mono text-xs">
                  {f}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Aucune fonctionnalité listée (vue vide ou indisponible).</p>
          )}
        </div>
      </section>
    </div>
  )
}
