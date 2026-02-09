import { Button } from "@/components/ui/button"
import { ArrowRight, Star } from "lucide-react"

const variants = ["primary", "secondary", "ghost"] as const
const sizes = ["sm", "md", "lg"] as const

export default function DebugUIPage() {
  return (
    <main className="min-h-screen p-6 space-y-10 bg-white text-slate-900">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">UI Catalogue</h1>
        <p className="text-sm text-slate-500">
          Buttons — variants × sizes + states (hover/pressed/disabled)
        </p>
      </header>

      {/* Grid variants x sizes */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Variants × Sizes</h2>

        <div className="grid gap-4 md:grid-cols-3">
          {variants.map((variant) => (
            <div key={variant} className="rounded-xl border border-slate-200 p-4 space-y-3">
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
                    leftIcon={<Star className="size-4" />}
                    rightIcon={<ArrowRight className="size-4" />}
                  >
                    Icons {size}
                  </Button>
                ))}
              </div>
            </div>
          ))}
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
            <span className="font-medium">pressed</span> : survole / maintiens le clic.
          </div>
        </div>
      </section>
    </main>
  )
}
