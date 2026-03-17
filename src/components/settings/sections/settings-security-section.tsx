import { Button } from "@/components/ui/button"
import { SettingsSectionCard } from "@/components/settings/settings-section-card"

export function SettingsSecuritySection() {
  return (
    <SettingsSectionCard
      id="securite"
      title="Sécurité"
      description="Gère ton mot de passe, tes sessions actives et les accès sensibles."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <ActionCard
          title="Mot de passe"
          description="Modifie ton mot de passe pour sécuriser ton compte."
          actionLabel="Changer"
        />
        <ActionCard
          title="Sessions"
          description="Consulte et révoque les sessions actives."
          actionLabel="Gérer"
        />
      </div>
    </SettingsSectionCard>
  )
}

function ActionCard({
  title,
  description,
  actionLabel,
}: {
  title: string
  description: string
  actionLabel: string
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4">
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
      <div className="mt-4">
        <Button variant="secondary" size="sm">
          {actionLabel}
        </Button>
      </div>
    </div>
  )
}