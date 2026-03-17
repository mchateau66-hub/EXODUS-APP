import { Button } from "@/components/ui/button"
import { SettingsSectionCard } from "@/components/settings/settings-section-card"

export function SettingsProfileSection() {
  return (
    <SettingsSectionCard
      id="profil"
      title="Profil"
      description="Mets à jour tes informations visibles, ton identité et ton positionnement."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nom complet" value="À connecter" />
        <Field label="Email" value="À connecter" />
        <Field label="Ville" value="À connecter" />
        <Field label="Rôle" value="À connecter" />
      </div>

      <div className="mt-6">
        <Button variant="primary" size="sm">
          Enregistrer
        </Button>
      </div>
    </SettingsSectionCard>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4">
      <div className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  )
}