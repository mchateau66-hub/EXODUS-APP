"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import { ArrowRight, Shield, Sparkles, Zap } from "lucide-react"
import { usePricingSelection, type Billing, type PublicOffer } from "@/components/public/pricing-selection"

function Container({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4">{children}</div>
}

export function ProblemSolution() {
  return (
    <section id="features" className="py-10 md:py-14">
      <Container>
        <div className="mb-6">
          <h2 className="text-xl font-semibold md:text-2xl">
            Un parcours clair, une expérience premium.
          </h2>
          <p className="mt-2 text-sm text-[var(--text-muted)] md:text-base">
            Moins de friction. Plus de confiance. Tout est pensé pour passer à l’action.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card variant="default" padding="lg">
            <div className="text-sm font-semibold">Découvrir</div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Explore les coachs par besoin, spécialité et style.
            </p>
          </Card>

          <Card variant="default" padding="lg">
            <div className="text-sm font-semibold">Choisir</div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Compare en un coup d’œil : durée, format, avis, approche.
            </p>
          </Card>

          <Card variant="default" padding="lg">
            <div className="text-sm font-semibold">Réserver</div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Réservation simple, paiement clair, accès immédiat.
            </p>
          </Card>
        </div>
      </Container>
    </section>
  )
}

export function HowItWorks() {
  return (
    <section className="py-10 md:py-14">
      <Container>
        <div className="mb-6">
          <h2 className="text-xl font-semibold md:text-2xl">Comment ça marche</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)] md:text-base">
            3 étapes, zéro complexité.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card variant="default" padding="lg">
            <div className="text-xs text-[var(--text-muted)]">Étape 1</div>
            <div className="mt-1 text-sm font-semibold">Définis ton objectif</div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Confiance, relation, carrière, mindset… tu choisis.
            </p>
          </Card>

          <Card variant="default" padding="lg">
            <div className="text-xs text-[var(--text-muted)]">Étape 2</div>
            <div className="mt-1 text-sm font-semibold">Trouve un coach</div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Profils clairs, approche décrite, avis transparents.
            </p>
          </Card>

          <Card variant="default" padding="lg">
            <div className="text-xs text-[var(--text-muted)]">Étape 3</div>
            <div className="mt-1 text-sm font-semibold">Passe à l’action</div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Une session suffit pour débloquer une prochaine étape.
            </p>
          </Card>
        </div>
      </Container>
    </section>
  )
}

export function Pricing() {
  const sp = useSearchParams()
  

  const planParam = (sp.get("plan") ?? "").toLowerCase() // standard | pro
  const billingParam = (sp.get("billing") ?? "").toLowerCase() // monthly | yearly
  const { role, setRole, offer, setOffer, billing, setBilling } = usePricingSelection()

  const [highlight, setHighlight] = React.useState(false)

  // Sync from URL -> state (keeps deep links working)
  React.useEffect(() => {
    if (billingParam === "yearly") setBilling("yearly")
    if (billingParam === "monthly") setBilling("monthly")
  }, [billingParam, setBilling])

  React.useEffect(() => {
    const normalizedOffer: PublicOffer | null =
      planParam === "pro" ? "pro" : planParam === "standard" ? "standard" : null

    if (normalizedOffer) {
      setOffer(normalizedOffer)
      setHighlight(true)
      const t = window.setTimeout(() => setHighlight(false), 950)
      return () => window.clearTimeout(t)
    }
  }, [planParam, setOffer])

  const isYearly = billing === "yearly"
  const yearlyDiscount = 0.8

  const prices = {
    discovery: { monthly: 0, yearly: 0 },
    standard: { monthly: 19, yearly: Math.round(19 * yearlyDiscount) },
    pro: { monthly: 39, yearly: Math.round(39 * yearlyDiscount) },
  } as const

  // Funnel links
  const signupFreeHref = `/signup?role=${role}&plan=free&src=pricing&offer=discovery`
  const signupStandardHref = `/signup?role=${role}&plan=premium&src=pricing&offer=standard&billing=${billing}`
  const signupProHref = `/signup?role=${role}&plan=premium&src=pricing&offer=pro&billing=${billing}`

  return (
    <section id="pricing" className="py-10 md:py-14">
      <Container>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
  <div>
    <h2 className="text-xl font-semibold md:text-2xl">Offres</h2>
    <p className="mt-2 text-sm text-[var(--text-muted)] md:text-base">
      Simple, transparent. Tu choisis ce qui te convient.
    </p>
  </div>

  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
    {/* Role switch (global funnel) */}
    <div
      className="flex items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-1"
      role="group"
      aria-label="Choix du profil"
    >
      <button
        type="button"
        onClick={() => setRole("athlete")}
        className={cn(
          "rounded-2xl px-3 py-2 text-sm font-medium transition-[background-color,color,opacity] duration-150",
          role === "athlete"
            ? "bg-[var(--bg-muted)] text-[var(--text)]"
            : "text-[var(--text-muted)] hover:text-[var(--text)]"
        )}
        aria-pressed={role === "athlete"}
      >
        Athlète
      </button>

      <button
        type="button"
        onClick={() => setRole("coach")}
        className={cn(
          "rounded-2xl px-3 py-2 text-sm font-medium transition-[background-color,color,opacity] duration-150",
          role === "coach"
            ? "bg-[var(--bg-muted)] text-[var(--text)]"
            : "text-[var(--text-muted)] hover:text-[var(--text)]"
        )}
        aria-pressed={role === "coach"}
      >
        Coach
      </button>
    </div>

    {/* Billing toggle (inchangé) */}
    <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-1">
      <button
        type="button"
        onClick={() => setBilling("monthly")}
        className={cn(
          "rounded-2xl px-3 py-2 text-sm font-medium transition-[background-color,color,opacity] duration-150",
          billing === "monthly"
            ? "bg-[var(--bg-muted)] text-[var(--text)]"
            : "text-[var(--text-muted)] hover:text-[var(--text)]"
        )}
        aria-pressed={billing === "monthly"}
      >
        Mensuel
      </button>

      <button
        type="button"
        onClick={() => setBilling("yearly")}
        className={cn(
          "rounded-2xl px-3 py-2 text-sm font-medium transition-[background-color,color,opacity] duration-150",
          billing === "yearly"
            ? "bg-[var(--bg-muted)] text-[var(--text)]"
            : "text-[var(--text-muted)] hover:text-[var(--text)]"
        )}
        aria-pressed={billing === "yearly"}
      >
        Annuel
      </button>

      <Badge variant="accent" className="ml-1">
        -20%
      </Badge>
    </div>
  </div>
</div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Découverte */}
          <Card variant="default" padding="lg">
            <div className="text-sm font-semibold">Découverte</div>
            <div className="mt-2 text-3xl font-semibold">
              {prices.discovery[billing]}€{" "}
              <span className="text-sm font-medium text-[var(--text-muted)]">
                / essai
              </span>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-[var(--text-muted)]">
              <li>Accès aux profils</li>
              <li>Comparaison</li>
              <li>Onboarding rapide</li>
            </ul>
            <div className="mt-5">
              <Button
                asChild
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => setOffer("standard")} /* next step default */
              >
                <Link href={signupFreeHref}>Essayer</Link>
              </Button>
            </div>
          </Card>

          {/* Standard (highlight target) */}
          <Card
            variant="elevated"
            padding="lg"
            data-pricing-highlight={
              highlight && (planParam === "standard" || planParam === "pro")
                ? "true"
                : undefined
            }
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Standard</div>
              <Badge variant="accent">Populaire</Badge>
            </div>

            <div className="mt-2 text-3xl font-semibold">
              {prices.standard[billing]}€{" "}
              <span className="text-sm font-medium text-[var(--text-muted)]">
                / mois
              </span>
            </div>

            <div className="mt-2 text-xs text-[var(--text-muted)]">
              {isYearly
                ? "Facturé annuellement • Économie ~20%"
                : "Facturation mensuelle • Annulable à tout moment"}
            </div>

            <ul className="mt-4 space-y-2 text-sm text-[var(--text-muted)]">
              <li>Réservation simplifiée</li>
              <li>Accès aux contenus</li>
              <li>Support prioritaire</li>
            </ul>

            <div className="mt-5">
              <Button
                asChild
                variant="primary"
                size="md"
                fullWidth
                rightIcon={<ArrowRight className="size-4" />}
                onClick={() => setOffer("standard")}
              >
                <Link href={signupStandardHref}>Commencer</Link>
              </Button>
            </div>
          </Card>

          {/* Pro */}
          <Card variant="default" padding="lg">
            <div className="text-sm font-semibold">Pro</div>
            <div className="mt-2 text-3xl font-semibold">
              {prices.pro[billing]}€{" "}
              <span className="text-sm font-medium text-[var(--text-muted)]">
                / mois
              </span>
            </div>

            <div className="mt-2 text-xs text-[var(--text-muted)]">
              {isYearly
                ? "Facturé annuellement • Meilleure valeur"
                : "Facturation mensuelle • Pour un suivi avancé"}
            </div>

            <ul className="mt-4 space-y-2 text-sm text-[var(--text-muted)]">
              <li>Suivi avancé</li>
              <li>Sessions & historique</li>
              <li>Accès nouveautés</li>
            </ul>

            <div className="mt-5">
              <Button
                asChild
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => setOffer("pro")}
              >
                <Link href={signupProHref}>
                  Commencer Pro
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </Container>
    </section>
  )
}

export function WhyUs() {
  return (
    <section className="py-10 md:py-14">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold md:text-2xl">
              Pourquoi Rencontre Coach
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)] md:text-base">
              Une expérience premium, simple, et conçue pour la confiance.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="accent">Clair</Badge>
            <Badge variant="accent">Rassurant</Badge>
            <Badge variant="accent">Rapide</Badge>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card variant="default" padding="lg">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-2">
                <Sparkles className="size-4 text-[var(--accent)]" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold">Choix sans doute</div>
                <p className="text-sm text-[var(--text-muted)]">
                  Profils lisibles, approche claire, attentes alignées dès le départ.
                </p>
              </div>
            </div>
          </Card>

          <Card variant="default" padding="lg">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-2">
                <Shield className="size-4 text-[var(--accent)]" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold">Confiance</div>
                <p className="text-sm text-[var(--text-muted)]">
                  Transparence sur le format, la durée, et ce que tu obtiens réellement.
                </p>
              </div>
            </div>
          </Card>

          <Card variant="default" padding="lg">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-2">
                <Zap className="size-4 text-[var(--accent)]" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold">Action immédiate</div>
                <p className="text-sm text-[var(--text-muted)]">
                  Réservation fluide. Une session pour débloquer la prochaine étape.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}

export function FinalCTA() {
  const { role, offer, billing, hasSeenPricing } = usePricingSelection()

  const offerLabel = offer === "pro" ? "Pro" : "Standard"
  const signupHref = `/signup?role=${role}&plan=premium&src=finalcta&offer=${offer}&billing=${billing}`

  const primaryLabel = hasSeenPricing ? `Commencer ${offerLabel}` : "Voir les offres"
  const primaryHref = hasSeenPricing ? signupHref : "#pricing"

  return (
    <section id="final-cta" className="py-12 md:py-16">
      <div className="mx-auto w-full max-w-6xl px-4">
        <Card variant="default" padding="lg" className="relative overflow-hidden md:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ backgroundColor: "var(--premium-cta-wash)" }}
          />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 max-w-xl">
              <div className="text-xl font-semibold tracking-tight md:text-2xl">
                Prêt à passer à l’étape suivante ?
              </div>
              <div className="text-sm text-[var(--text-muted)] md:text-base">
                Continue avec l’offre {offerLabel} en {billing === "yearly" ? "annuel" : "mensuel"}.
                <br className="hidden md:block" />
                Une décision claire. Une action simple.
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="primary" size="md">
                <a href={primaryHref}>{primaryLabel}</a>
              </Button>

              <Button asChild variant="secondary" size="md">
                <a href="#features">En savoir plus</a>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}
