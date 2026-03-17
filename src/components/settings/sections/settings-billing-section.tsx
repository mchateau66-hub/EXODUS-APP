import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SettingsSectionCard } from "@/components/settings/settings-section-card"

export function SettingsBillingSection() {
  return (
    <SettingsSectionCard
      id="facturation"
      title="Facturation"
      description="Retrouve ton abonnement, tes accès premium et les actions de gestion Stripe."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4">
          <div className="text-sm font-semibold">Abonnement actuel</div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            À connecter aux entitlements et à Stripe.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4">
          <div className="text-sm font-semibold">Portail de facturation</div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Permettra de gérer le moyen de paiement et les factures.
          </p>
          <div className="mt-4">
            <Button asChild variant="primary" size="sm">
              <Link href="/paywall">Voir les offres</Link>
            </Button>
          </div>
        </div>
      </div>
    </SettingsSectionCard>
  )
}