"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Star, Moon } from "lucide-react"

const variants = ["primary", "secondary", "ghost"] as const
const sizes = ["sm", "md", "lg"] as const

export default function DebugUIPage() {
  return (
    <main className="min-h-screen p-6 space-y-10 bg-white text-slate-900">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">UI Catalogue</h1>
        <p className="text-sm text-slate-500">
          Buttons — variants × sizes + states + iconOnly + fullWidth + asChild
        </p>
      </header>

      {/* Variants x sizes */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Variants × Sizes</h2>

        <div className="grid gap-4 md:grid-cols-3">
          {variants.map((variant) => (
            <div
              key={variant}
              className="rounded-xl border border-slate-200 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{variant}</div>
                <div className="text-xs text-slate-500">default</div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {sizes.map((size) => (
                  <Button key={size} variant={variant} size={size}>
                    {variant} {size}
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {sizes.map((size) => (
                  <Button
                    key={size}
                    variant={variant}
                    size={size}
                    leftIcon={<Star />}
                    rightIcon={<ArrowRight />}
                  >
                    Icons {size}
                  </Button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {sizes.map((size) => (
                  <Button key={size} variant={variant} size={size} loading>
                    Loading {size}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Layout */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Layout</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="text-sm font-medium">fullWidth (max-w-md)</div>
            <div className="max-w-md space-y-3">
              <Button fullWidth>Primary full</Button>
              <Button fullWidth variant="secondary">
                Secondary full
              </Button>
              <Button fullWidth variant="ghost">
                Ghost full
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="text-sm font-medium">asChild (Link)</div>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link href="/signup">Go to /signup</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/debug/ui">Reload</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/">Home</Link>
              </Button>
            </div>

            <div className="text-xs text-slate-500">
              Note: si tu veux désactiver un Link-bouton, utilise{" "}
              <code>aria-disabled</code> + styles / guard côté click (on peut le
              faire ensuite).
            </div>
          </div>
        </div>
      </section>

      {/* States */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">States</h2>

        <div className="rounded-xl border border-slate-200 p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Default</Button>
            <Button disabled>Disabled</Button>
            <Button loading>Loading</Button>
          </div>

          <div className="text-sm text-slate-500">
            Pour tester <span className="font-medium">hover</span> et{" "}
            <span className="font-medium">pressed</span> : survole / maintiens le
            clic.
          </div>
        </div>
      </section>

      {/* iconOnly */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">iconOnly</h2>

        <div className="rounded-xl border border-slate-200 p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button iconOnly aria-label="Favori">
              <Star />
            </Button>
            <Button iconOnly variant="secondary" aria-label="Mode nuit">
              <Moon />
            </Button>
            <Button iconOnly variant="ghost" aria-label="Aller à droite">
              <ArrowRight />
            </Button>

            <Button iconOnly size="sm" aria-label="Petit favori">
              <Star />
            </Button>
            <Button iconOnly size="lg" aria-label="Grand favori">
              <Star />
            </Button>

            <Button iconOnly loading aria-label="Chargement">
              <Star />
            </Button>
          </div>

          <div className="text-xs text-slate-500">
            <code>iconOnly</code> exige un <code>aria-label</code> (warning en dev
            si oublié).
          </div>
        </div>
      </section>
    </main>
  )
}
