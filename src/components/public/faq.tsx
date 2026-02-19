"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

type FAQItem = {
  question: string
  answer: React.ReactNode
}

const DEFAULT_FAQ: FAQItem[] = [
  {
    question: "Comment choisir un coach ?",
    answer: (
      <>
        Parcours les profils, lis l’approche et les avis, puis commence par une
        session découverte. L’objectif : valider le “fit” rapidement.
      </>
    ),
  },
  {
    question: "Puis-je annuler ou déplacer une session ?",
    answer: (
      <>
        Oui. Les règles dépendent du coach, mais l’interface te guide clairement
        (délais, conditions, etc.).
      </>
    ),
  },
  {
    question: "Quels formats sont disponibles ?",
    answer: (
      <>
        Visio, audio, ou en présentiel selon les coachs. La durée et le format
        sont indiqués avant réservation.
      </>
    ),
  },
  {
    question: "Est-ce que je peux tester avant de m’engager ?",
    answer: (
      <>
        Oui. La landing est pensée pour une entrée simple : découverte, première
        réservation, puis décision.
      </>
    ),
  },
  {
    question: "Comment fonctionne l’abonnement ?",
    answer: (
      <>
        Il débloque des fonctionnalités (accès, contenu, suivi…). Tu peux changer
        d’offre ou arrêter à tout moment.
      </>
    ),
  },
]

export function FAQ({
  items = DEFAULT_FAQ,
  className,
}: {
  items?: FAQItem[]
  className?: string
}) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0)

  return (
    <section id="faq" className={cn("py-10 md:py-14", className)}>
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="mb-6">
          <h2 className="text-xl font-semibold md:text-2xl">FAQ</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)] md:text-base">
            Réponses courtes, claires — pour avancer sans friction.
          </p>
        </div>

        <div className="grid gap-3">
          {items.map((it, idx) => {
            const open = openIndex === idx
            const buttonId = `faq-btn-${idx}`
            const panelId = `faq-panel-${idx}`

            return (
              <Card
                key={it.question}
                variant="default"
                padding="md"
                interactive
                className="p-0"
              >
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(open ? null : idx)}
                  className={cn(
                    "flex w-full items-center justify-between gap-4 rounded-[var(--radius-lg)] px-4 py-4 text-left",
                    "transition-[background-color] duration-150",
                    "hover:bg-[var(--card-bg-hover)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2",
                    "ring-offset-white dark:ring-offset-slate-950"
                  )}
                >
                  <span className="text-sm font-semibold">{it.question}</span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200",
                      open ? "rotate-180" : "rotate-0"
                    )}
                    aria-hidden="true"
                  />
                </button>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200",
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="px-4 pb-4 text-sm text-[var(--text-muted)]">
                      {it.answer}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
