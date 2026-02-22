"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Plus, ArrowRight, Trash2, Settings } from "lucide-react"

type Variant = "primary" | "secondary" | "ghost"
type Size = "sm" | "md" | "lg"

type DebugState = "default" | "hover" | "pressed" | "focus"
const DEBUG_STATES: DebugState[] = ["default", "hover", "pressed", "focus"]

const VARIANTS: Variant[] = ["primary", "secondary", "ghost"]
const SIZES: Size[] = ["sm", "md", "lg"]

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-background p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  )
}

function Card({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-muted/20 p-4",
        className
      )}
    >
      <div className="mb-3 text-xs font-medium text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

export default function DebugButtonsPage() {
  const [fullWidth, setFullWidth] = React.useState(false)
  const [withIcons, setWithIcons] = React.useState(true)
  const [debugState, setDebugState] = React.useState<DebugState>("default")

  const forcedState = debugState === "default" ? undefined : debugState

  const Left = withIcons ? <Plus className="size-4" /> : null
  const Right = withIcons ? <ArrowRight className="size-4" /> : null

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">DebugUI — Buttons</h1>
        <p className="text-sm text-muted-foreground">
          Tu peux forcer visuellement les states via la toolbar (sans hover réel).
          Focus via Tab (focus-visible) ou via state=focus.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={fullWidth}
            onChange={(e) => setFullWidth(e.target.checked)}
          />
          fullWidth
        </label>

        <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={withIcons}
            onChange={(e) => setWithIcons(e.target.checked)}
          />
          icônes
        </label>

        <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
          State
          <select
            className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
            value={debugState}
            onChange={(e) => setDebugState(e.target.value as DebugState)}
          >
            {DEBUG_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDebugState("default")}
          data-state={forcedState}
        >
          Reset
        </Button>

        <div className="text-xs text-muted-foreground">
          Astuce : <kbd className="rounded border px-1">Tab</kbd> pour vérifier
          focus-visible (vrai focus).
        </div>
      </div>

      <div className="grid gap-6">
        {/* Matrix */}
        <Section
          title="Matrice (variant × size)"
          description="Forçage via data-state (hover/pressed/focus) + test réel possible à la souris/clavier."
        >
          <div className="space-y-5">
            {VARIANTS.map((variant) => (
              <div key={variant} className="space-y-3">
                <div className="text-sm font-medium capitalize">{variant}</div>
                <div className="grid gap-3 md:grid-cols-3">
                  {SIZES.map((size) => (
                    <Card key={`${variant}-${size}`} title={`size: ${size}`}>
                      <Button
                        data-state={forcedState}
                        variant={variant}
                        size={size}
                        fullWidth={fullWidth}
                        leftIcon={Left}
                        rightIcon={Right}
                      >
                        Continuer
                      </Button>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* States */}
        <Section
          title="States (disabled / loading)"
          description="Disabled doit couper toute interaction. Loading doit garder le layout (pas de shift)."
        >
          <Grid>
            {VARIANTS.map((variant) => (
              <Card key={`states-${variant}`} title={`variant: ${variant}`}>
                <Button
                  data-state={forcedState}
                  variant={variant}
                  size="md"
                  disabled
                  leftIcon={withIcons ? <Settings className="size-4" /> : null}
                >
                  Disabled
                </Button>

                <Button
                  data-state={forcedState}
                  variant={variant}
                  size="md"
                  loading
                  leftIcon={Left}
                  rightIcon={Right}
                >
                  Loading
                </Button>
              </Card>
            ))}
          </Grid>
        </Section>

        {/* Icon only */}
        <Section
          title="Icon-only"
          description="Carré, tap target, aria-label obligatoire. Loading doit rester carré."
        >
          <Grid>
            {SIZES.map((size) => (
              <Card key={`icononly-${size}`} title={`size: ${size}`}>
                <Button
                  data-state={forcedState}
                  variant="primary"
                  size={size}
                  iconOnly
                  aria-label="Ajouter"
                >
                  <Plus className="size-4" />
                </Button>

                <Button
                  data-state={forcedState}
                  variant="secondary"
                  size={size}
                  iconOnly
                  aria-label="Paramètres"
                >
                  <Settings className="size-4" />
                </Button>

                <Button
                  data-state={forcedState}
                  variant="ghost"
                  size={size}
                  iconOnly
                  aria-label="Supprimer"
                >
                  <Trash2 className="size-4" />
                </Button>

                <Button
                  data-state={forcedState}
                  variant="primary"
                  size={size}
                  iconOnly
                  loading
                  aria-label="Chargement"
                >
                  <Plus className="size-4" />
                </Button>
              </Card>
            ))}
          </Grid>
        </Section>

        {/* asChild */}
        <Section
          title="asChild (Link-like)"
          description="Test réel: <a> et next/link. Disabled/Loading ne doivent pas naviguer."
        >
          <Grid>
            <Card title="asChild=true (anchor)">
              <Button data-state={forcedState} asChild variant="primary" size="md">
                <a href="#ok">Lien primaire</a>
              </Button>

              <Button
                data-state={forcedState}
                asChild
                variant="secondary"
                size="md"
                disabled
              >
                <a href="#nope">Lien disabled</a>
              </Button>

              <Button data-state={forcedState} asChild variant="ghost" size="md" loading>
                <a href="#nope2">Lien loading</a>
              </Button>
            </Card>

            <Card title="asChild=true (Next Link)">
              <Button data-state={forcedState} asChild variant="primary" size="md">
                <Link href="/debug/buttons">Next Link primaire</Link>
              </Button>

              <Button
                data-state={forcedState}
                asChild
                variant="secondary"
                size="md"
                disabled
              >
                <Link href="/debug/buttons">Next Link disabled</Link>
              </Button>

              <Button data-state={forcedState} asChild variant="ghost" size="md" loading>
                <Link href="/debug/buttons">Next Link loading</Link>
              </Button>
            </Card>
          </Grid>
        </Section>

        {/* Stress tests */}
        <Section
          title="Stress tests"
          description="Long label / wrap / icônes / fullWidth: doit rester stable (pas de padding/layout qui change)."
        >
          <Grid>
            <Card title="Long label (wrap)">
              <Button
                data-state={forcedState}
                variant="primary"
                size="md"
                fullWidth={fullWidth}
                leftIcon={Left}
                rightIcon={Right}
              >
                Continuer vers la prochaine étape avec un libellé très long
              </Button>
            </Card>

            <Card title="Sans icônes">
              <Button
                data-state={forcedState}
                variant="secondary"
                size="md"
                fullWidth={fullWidth}
              >
                Action
              </Button>
              <Button
                data-state={forcedState}
                variant="ghost"
                size="md"
                fullWidth={fullWidth}
              >
                Action secondaire
              </Button>
            </Card>

            <Card title="Full width forced">
              <div className="w-full">
                <Button
                  data-state={forcedState}
                  variant="primary"
                  size="md"
                  fullWidth
                  leftIcon={Left}
                  rightIcon={Right}
                >
                  Pleine largeur
                </Button>
              </div>
            </Card>
          </Grid>
        </Section>
      </div>
    </main>
  )
}
