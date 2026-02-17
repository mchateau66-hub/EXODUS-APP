"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { usePricingSelection } from "@/components/public/pricing-selection"

type StickyCTAProps = {
  heroId?: string
  footerId?: string
  pricingId?: string
}

export function StickyCTA({
  heroId = "hero",
  pricingId = "pricing",
  footerId = "footer",
}: StickyCTAProps) {
  const { role, offer, billing, hasSeenPricing } = usePricingSelection()

  const [dismissed, setDismissed] = React.useState(false)
  const [afterHero, setAfterHero] = React.useState(false)
  const [nearFooter, setNearFooter] = React.useState(false)

  React.useEffect(() => {
    const hero = document.getElementById(heroId)
    const footer = document.getElementById(footerId)

    const heroSentinel = hero ? ensureSentinelAfter(hero, "sticky-cta-hero-sentinel") : null
    const footerSentinel = footer ? ensureSentinelBefore(footer, "sticky-cta-footer-sentinel") : null

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.target === heroSentinel) setAfterHero(e.isIntersecting)
          if (e.target === footerSentinel) setNearFooter(e.isIntersecting)
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -10% 0px" }
    )

    if (heroSentinel) io.observe(heroSentinel)
    if (footerSentinel) io.observe(footerSentinel)

    let onScroll: (() => void) | null = null
    if (!heroSentinel || !footerSentinel) {
      onScroll = () => {
        if (!heroSentinel) setAfterHero(window.scrollY > 240)
        if (!footerSentinel) {
          const nearBottom =
            window.innerHeight + window.scrollY >= document.body.offsetHeight - 240
          setNearFooter(nearBottom)
        }
      }
      onScroll()
      window.addEventListener("scroll", onScroll, { passive: true })
    }

    return () => {
      io.disconnect()
      if (onScroll) window.removeEventListener("scroll", onScroll)
    }
  }, [heroId, footerId])

  const visible = !dismissed && afterHero && !nearFooter

  const offerLabel = offer === "pro" ? "Pro" : "Standard"
  const signupHref = `/signup?role=${role}&plan=premium&src=sticky&offer=${offer}&billing=${billing}`

  // Avant pricing: scroll. Après pricing: signup direct.
  const primaryLabel = hasSeenPricing ? `Commencer ${offerLabel}` : "Voir les offres"
  const primaryHref = hasSeenPricing ? signupHref : `#${pricingId}`

  return (
    <div
      className={[
        "fixed inset-x-0 bottom-0 z-[60]",
        "px-4 pb-4",
        "transition-[transform,opacity] duration-200",
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none",
      ].join(" ")}
      aria-hidden={!visible}
    >
      <div className="mx-auto w-full max-w-6xl">
        <div
          className={[
            "flex items-center justify-between gap-3 rounded-2xl",
            "border border-[var(--header-border)]",
            "bg-[var(--header-bg)] shadow-[var(--card-shadow-elevated)]",
            "supports-[backdrop-filter]:backdrop-blur-[var(--header-backdrop)]",
            "px-3 py-3 md:px-4",
          ].join(" ")}
          role="region"
          aria-label="Appel à l’action"
        >
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">Prêt à commencer ?</div>
            <div className="text-xs text-[var(--text-muted)]">
              Continue avec l’offre {offerLabel} en {billing === "yearly" ? "annuel" : "mensuel"}.
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDismissed(true)}>
              Plus tard
            </Button>

            <Button asChild variant="primary" size="sm" rightIcon={<ArrowRight className="size-4" />}>
              <a href={primaryHref} aria-label={primaryLabel}>
                {primaryLabel}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ensureSentinelAfter(target: HTMLElement, id: string) {
  const existing = document.getElementById(id)
  if (existing) return existing
  const el = document.createElement("div")
  el.id = id
  el.setAttribute("aria-hidden", "true")
  el.style.cssText = "width:1px;height:1px;margin:0;padding:0;"
  if (target.nextSibling) target.parentNode?.insertBefore(el, target.nextSibling)
  else target.parentNode?.appendChild(el)
  return el
}

function ensureSentinelBefore(target: HTMLElement, id: string) {
  const existing = document.getElementById(id)
  if (existing) return existing
  const el = document.createElement("div")
  el.id = id
  el.setAttribute("aria-hidden", "true")
  el.style.cssText = "width:1px;height:1px;margin:0;padding:0;"
  target.parentNode?.insertBefore(el, target)
  return el
}
