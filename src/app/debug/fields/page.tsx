"use client"

import * as React from "react"
import { TextField } from "@/components/ui/text-field"
import { cn } from "@/lib/utils"
import { Mail, Lock, Search, Eye } from "lucide-react"

type Size = "sm" | "md" | "lg"
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
    <div className={cn("rounded-2xl border border-border bg-muted/20 p-4", className)}>
      <div className="mb-3 text-xs font-medium text-muted-foreground">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

export default function DebugFieldsPage() {
  const [fullWidth, setFullWidth] = React.useState(true)
  const [withIcons, setWithIcons] = React.useState(true)

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">DebugUI — Fields</h1>
        <p className="text-sm text-muted-foreground">
          Vérifie focus ring, hover, error, disabled, loading, icons, tailles.
        </p>
      </div>

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
      </div>

      <div className="grid gap-6">
        <Section title="Tailles" description="sm / md / lg">
          <Grid>
            {SIZES.map((size) => (
              <Card key={size} title={`size: ${size}`}>
                <TextField
                  size={size}
                  fullWidth={fullWidth}
                  label="Email"
                  placeholder="you@domain.com"
                  leftIcon={withIcons ? <Mail className="size-4" /> : undefined}
                  rightIcon={withIcons ? <Search className="size-4" /> : undefined}
                />

                <TextField
                  size={size}
                  fullWidth={fullWidth}
                  label="Mot de passe"
                  placeholder="••••••••"
                  type="password"
                  leftIcon={withIcons ? <Lock className="size-4" /> : undefined}
                  rightIcon={withIcons ? <Eye className="size-4" /> : undefined}
                />
              </Card>
            ))}
          </Grid>
        </Section>

        <Section title="States" description="default / error / disabled / loading">
          <Grid>
            <Card title="Default + description">
              <TextField
                fullWidth={fullWidth}
                label="Recherche"
                description="Tape une requête puis Enter."
                placeholder="Rechercher…"
                leftIcon={withIcons ? <Search className="size-4" /> : undefined}
              />
            </Card>

            <Card title="Error">
              <TextField
                fullWidth={fullWidth}
                label="Email"
                required
                placeholder="you@domain.com"
                error="Email invalide. Vérifie le format."
                leftIcon={withIcons ? <Mail className="size-4" /> : undefined}
              />
            </Card>

            <Card title="Disabled">
              <TextField
                fullWidth={fullWidth}
                label="Champ désactivé"
                placeholder="Disabled"
                disabled
                leftIcon={withIcons ? <Lock className="size-4" /> : undefined}
              />
            </Card>

            <Card title="Loading">
              <TextField
                fullWidth={fullWidth}
                label="Vérification…"
                placeholder="En cours…"
                loading
                leftIcon={withIcons ? <Mail className="size-4" /> : undefined}
              />
            </Card>

            <Card title="No label (just input)">
              <TextField
                fullWidth={fullWidth}
                placeholder="Sans label"
              />
            </Card>

            <Card title="Long label / long description">
              <TextField
                fullWidth={fullWidth}
                label="Libellé très long pour vérifier l’alignement et le wrap"
                description="Description longue pour vérifier que la zone d’aide ne fait pas de layout shift quand on passe en erreur."
                placeholder="Test…"
                leftIcon={withIcons ? <Mail className="size-4" /> : undefined}
                rightIcon={withIcons ? <Search className="size-4" /> : undefined}
              />
            </Card>
          </Grid>
        </Section>
      </div>
    </main>
  )
}
