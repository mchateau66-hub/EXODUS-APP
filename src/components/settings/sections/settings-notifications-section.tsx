import { SettingsSectionCard } from "@/components/settings/settings-section-card"

export function SettingsNotificationsSection() {
  return (
    <SettingsSectionCard
      id="notifications"
      title="Notifications"
      description="Choisis quand et comment recevoir les alertes importantes."
    >
      <div className="grid gap-3">
        <ToggleRow
          title="Emails produit"
          description="Recevoir les mises à jour importantes de la plateforme."
        />
        <ToggleRow
          title="Nouveaux messages"
          description="Être alerté lors de nouveaux échanges."
        />
        <ToggleRow
          title="Facturation"
          description="Recevoir les notifications liées aux paiements et abonnements."
        />
      </div>
    </SettingsSectionCard>
  )
}

function ToggleRow({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
      </div>

      <div className="shrink-0 rounded-full bg-[var(--bg-muted)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
        À connecter
      </div>
    </div>
  )
}