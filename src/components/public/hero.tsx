"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, ShieldCheck, MessageSquareMore, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { track } from "@/lib/track"
import { usePricingSelection } from "@/components/public/pricing-selection"

export function Hero() {
  const router = useRouter()
  const pricing = usePricingSelection?.()

  const role = pricing?.role ?? "athlete"
  const billing = pricing?.billing ?? "monthly"

  const fastSignupHref = `/signup?role=${role}&plan=premium&src=hero&offer=standard&billing=${billing}`
  const pricingHref = "/#pricing"

  const onFastIntent = React.useCallback(() => {
    router.prefetch(fastSignupHref)
  }, [router, fastSignupHref])

  const onFastClick = React.useCallback(() => {
    track({
      event: "hero_click",
      role,
      offer: "standard",
      billing,
      src: "hero",
    })
  }, [role, billing])

  const onPricingClick = React.useCallback(() => {
    track({
      event: "hero_pricing_click",
      role,
      offer: "standard",
      billing,
      src: "hero",
    })
  }, [role, billing])

  return (
    <section id="hero" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--premium-hero-wash)" }}
      />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1 text-xs text-[var(--text-muted)]">
            <Sparkles className="size-3.5" />
            Plateforme coach ↔ athlète, rapide et claire
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl md:leading-[1.05]">
              Trouve le coach qui te correspond.
              <br />
              <span className="text-[var(--text-muted)]">
                Simple, humain, sécurisé.
              </span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-[var(--text-muted)] md:text-lg">
              Découvre, compare et contacte les bons profils selon tes objectifs.
              Une expérience sobre, rapide et conçue pour convertir sans friction.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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

            <Button asChild variant="secondary" size="md">
              <Link href={pricingHref} onClick={onPricingClick}>
                Voir les offres
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
            <span className="rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-2 py-1">
              Sans engagement
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-2 py-1">
              Messaging sécurisé
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-2 py-1">
              Réservation simple
            </span>
          </div>
        </div>

        <div className="relative">
          <Card variant="elevated" padding="lg" className="overflow-hidden">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold tracking-tight">
                    Aperçu de la plateforme
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Coachs, échanges et accès premium
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <Card variant="default" padding="md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <MessageSquareMore className="size-4" />
                        Coaching confiance
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        30 min • Visio • 4.9/5
                      </div>
                    </div>

                    <Button asChild size="sm" variant="primary">
                      <Link
                        href={fastSignupHref}
                        onMouseEnter={onFastIntent}
                        onFocus={onFastIntent}
                        onTouchStart={onFastIntent}
                        onClick={onFastClick}
                      >
                        Réserver
                      </Link>
                    </Button>
                  </div>
                </Card>

                <Card variant="default" padding="md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <ShieldCheck className="size-4" />
                        Échanges protégés
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-muted)]">
                        Accès maîtrisé • Entitlements sécurisés
                      </div>
                    </div>

                    <Button asChild size="sm" variant="secondary">
                      <Link href={pricingHref} onClick={onPricingClick}>
                        Voir
                      </Link>
                    </Button>
                  </div>
                </Card>

                <Card variant="ghost" padding="md">
                  <div className="text-xs text-[var(--text-muted)]">
                    Interface publique stabilisée pour une home claire, responsive
                    et prête pour la suite du produit.
                  </div>
                </Card>
              </div>
            </div>
          </Card>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-6 -z-10 rounded-[32px]"
            style={{ background: "var(--premium-hero-wash)", opacity: 0.35 }}
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="h-px w-full bg-[var(--premium-section-sep)]" />
      </div>
    </section>
  )
}