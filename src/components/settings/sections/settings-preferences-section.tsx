import { SettingsSectionCard } from "@/components/settings/settings-section-card"

export function SettingsPreferencesSection() {
  return (
    <SettingsSectionCard
      id="preferences"
      title="Préférences"
      description="Personnalise l’expérience de navigation et les comportements par défaut."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <PreferenceCard label="Langue" value="Français" />
        <PreferenceCard label="Thème" value="Synchronisé avec le sélecteur global" />
        <PreferenceCard label="Fuseau horaire" value="Europe/Paris" />
        <PreferenceCard label="Format d’affichage" value="À connecter" />
      </div>
    </SettingsSectionCard>
  )
}

function PreferenceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4">
      <div className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  )
}