"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

type Testimonial = {
  quote: string
  name: string
  meta: string
  initials: string
  verified?: boolean
}

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "J’ai trouvé un coach en 10 minutes. Première session très utile, j’avais enfin un plan clair.",
    name: "Sarah",
    meta: "Confiance • Visio • 30 min",
    initials: "S",
    verified: true,
  },
  {
    quote:
      "Interface super simple. On comprend tout de suite les offres et la réservation est rapide.",
    name: "Mehdi",
    meta: "Carrière • 45 min",
    initials: "M",
    verified: true,
  },
  {
    quote:
      "Le format et l’approche étaient transparents. J’ai pu choisir sans doute et avancer rapidement.",
    name: "Laura",
    meta: "Relation • 1h",
    initials: "L",
    verified: true,
  },
]

function Container({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4">{children}</div>
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] px-4 py-3">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
    </div>
  )
}

function Avatar({
  initials,
  className,
}: {
  initials: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full",
        "border border-[var(--border)] bg-[var(--bg-muted)]",
        "text-xs font-semibold text-[var(--text)]",
        className
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}

export function Testimonials({
  items = DEFAULT_TESTIMONIALS,
  className,
}: {
  items?: Testimonial[]
  className?: string
}) {
  return (
    <section className={cn("py-10 md:py-14", className)}>
      <Container>
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold md:text-2xl">
              Des résultats concrets, sans friction.
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)] md:text-base">
              Une expérience premium, pensée pour avancer vite.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="accent">Minimaliste</Badge>
            <Badge variant="accent">Transparent</Badge>
            <Badge variant="accent">Rapide</Badge>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Stat value="4.8/5" label="Satisfaction moyenne" />
          <Stat value="≤ 10 min" label="Pour trouver un coach" />
          <Stat value="1 session" label="Pour débloquer une étape" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {items.map((t) => (
            <Card
              key={t.quote}
              variant="default"
              padding="lg"
              className={cn(
                "h-full",
                // premium touch: very subtle hover only if interactive
                // (here we keep non-interactive by default)
                ""
              )}
            >
              <div className="flex h-full flex-col gap-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar initials={t.initials} />
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold">{t.name}</div>
                        {t.verified ? (
                          <Badge
                            variant="success"
                            className="gap-1"
                            title="Avis vérifié"
                          >
                            <Check className="size-3" aria-hidden="true" />
                            Vérifié
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {t.meta}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-[var(--text-muted)]">★★★★★</div>
                </div>

                {/* Quote */}
                <p className="text-sm leading-relaxed text-[var(--text)]">
                  “{t.quote}”
                </p>

                {/* Footer divider */}
                <div className="mt-auto border-t border-[var(--border)] pt-3">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>Session récente</span>
                    <span>Recommandé</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  )
}
