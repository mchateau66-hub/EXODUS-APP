import { SettingsSectionCard } from "@/components/settings/settings-section-card"

export function SettingsPrivacySection() {
  return (
    <SettingsSectionCard
      id="confidentialite"
      title="Confidentialité"
      description="Contrôle la visibilité de ton profil et certaines données exposées."
    >
      <div className="grid gap-3">
        <PrivacyRow
          title="Visibilité du profil"
          description="Détermine si ton profil est visible publiquement dans la plateforme."
        />
        <PrivacyRow
          title="Affichage des informations de contact"
          description="Encadre l’exposition des moyens de contact selon les accès."
        />
      </div>
    </SettingsSectionCard>
  )
}

function PrivacyRow({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4">
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
    </div>
  )
}