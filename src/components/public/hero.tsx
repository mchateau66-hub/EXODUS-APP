"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowRight } from "lucide-react"
import { track } from "@/lib/track"
import { usePricingSelection } from "@/components/public/pricing-selection"

export function Hero() {
  const router = useRouter()

  // Funnel state (global)
  const { role, billing } = usePricingSelection()

  // Fast lane (conversion-first) — always coherent with role/billing selection
  const fastSignupHref = `/signup?role=${role}&plan=premium&src=hero&offer=standard&billing=${billing}`

  // Slow lane (info-first)
  const pricingHref = "/?plan=standard#pricing"

  const onFastIntent = React.useCallback(() => {
    // Premium feel: instant navigation when user shows intent
    router.prefetch("/signup")
  }, [router])

  const onFastClick = React.useCallback(() => {
    track({
      event: "hero_click",
      role,
      offer: "standard",
      billing,
      src: "hero",
    })
  }, [role, billing])

  const onSlowClick = React.useCallback(() => {
    track({
      event: "hero_pricing_click",
      role,
      offer: "standard",
      billing,
      src: "hero",
    })
  }, [role, billing])

  const onMockPrimaryClick = React.useCallback(() => {
    track({
      event: "hero_mock_primary_click",
      role,
      offer: "standard",
      billing,
      src: "hero",
    })
  }, [role, billing])

  const onMockSecondaryClick = React.useCallback(() => {
    track({
      event: "hero_mock_secondary_click",
      role,
      offer: "standard",
      billing,
      src: "hero",
    })
  }, [role, billing])

  return (
    <section id="hero" className="relative overflow-hidden">
      {/* Premium wash (token) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--premium-hero-wash)" }}
      />

      <div className="mx-auto w-full max-w-6xl px-4 pt-16 pb-10 md:pt-24 md:pb-14">
        <div className="grid items-center gap-10 md:grid-cols-2">
          {/* Left */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1 text-xs text-[var(--text-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              Expérience premium, sans friction
            </div>

            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl md:leading-[1.05]">
              Trouve le coach qui te correspond.
              <br />
              <span className="text-[var(--text-muted)]">Simple, humain, efficace.</span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-[var(--text-muted)] md:text-lg">
              Rencontre Coach t’aide à découvrir, comparer et réserver un coach selon tes objectifs.
              Un parcours clair, une interface sobre, une décision rapide.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Fast lane (conversion-first) */}
              <Button
                asChild
                variant="primary"
                size="md"
                rightIcon={<ArrowRight className="size-4" />}
              >
                <Link
                  href={fastSignupHref}
                  onMouseEnter={onFastIntent}
                  onFocus={onFastIntent}
                  onTouchStart={onFastIntent}
                  onClick={onFastClick}
                >
                  Commencer
                </Link>
              </Button>

              {/* Slow lane (details-first) */}
              <Button asChild variant="secondary" size="md">
                <Link href={pricingHref} onClick={onSlowClick}>
                  Voir les offres
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-2 py-1">
                Sans engagement
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-2 py-1">
                Réservation simple
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-2 py-1">
                Expérience claire
              </span>
            </div>
          </div>

          {/* Right */}
          <div className="relative">
            <Card variant="elevated" padding="lg" className="overflow-hidden">
              <div className="space-y-4">
                <div className="text-sm font-semibold tracking-tight">Aperçu</div>

                <div className="grid gap-3">
                  <Card variant="default" padding="md">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">Coaching confiance</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          30 min • Visio • 4.9/5
                        </div>
                      </div>

                      {/* Micro fast lane inside mock */}
                      <Button asChild size="sm" variant="primary">
                        <Link
                          href={fastSignupHref}
                          onMouseEnter={onFastIntent}
                          onFocus={onFastIntent}
                          onTouchStart={onFastIntent}
                          onClick={onMockPrimaryClick}
                        >
                          Réserver
                        </Link>
                      </Button>
                    </div>
                  </Card>

                  <Card variant="default" padding="md">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">Préparation entretien</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          45 min • Visio • 4.8/5
                        </div>
                      </div>

                      <Button asChild size="sm" variant="secondary">
                        <Link href={pricingHref} onClick={onMockSecondaryClick}>
                          Voir
                        </Link>
                      </Button>
                    </div>
                  </Card>

                  <Card variant="ghost" padding="md">
                    <div className="text-xs text-[var(--text-muted)]">
                      Mockup minimaliste — remplaçable par une image produit plus tard.
                    </div>
                  </Card>
                </div>
              </div>
            </Card>

            {/* Subtle glow (token-only) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-6 -z-10 rounded-[32px]"
              style={{ background: "var(--premium-hero-wash)", opacity: 0.35 }}
            />
          </div>
        </div>
      </div>

      {/* Section separator */}
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="h-px w-full bg-[var(--premium-section-sep)]" />
      </div>
    </section>
  )
}
