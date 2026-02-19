"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/lib/useTheme"
import { cn } from "@/lib/utils"

export function ThemeToggle() {
  const { mode, resolvedTheme, setThemeMode, toggle } = useTheme()
  const ToggleIcon = resolvedTheme === "dark" ? Sun : Moon

  const pill =
    "inline-flex items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] shadow-sm p-1"

  const item =
    "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors"

  const active = "bg-[var(--bg-muted)] text-[var(--text)]"
  const inactive = "text-[var(--text-muted)] hover:bg-[var(--bg-muted)]/70"

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        iconOnly
        aria-label="Toggle light/dark"
        onClick={toggle}
      >
        <ToggleIcon />
      </Button>

      <div className={pill} role="group" aria-label="Theme mode">
        <button
          type="button"
          onClick={() => setThemeMode("system")}
          className={cn(item, mode === "system" ? active : inactive)}
          aria-pressed={mode === "system"}
        >
          <Monitor className="size-3.5" />
          System
        </button>

        <button
          type="button"
          onClick={() => setThemeMode("light")}
          className={cn(item, mode === "light" ? active : inactive)}
          aria-pressed={mode === "light"}
        >
          <Sun className="size-3.5" />
          Light
        </button>

        <button
          type="button"
          onClick={() => setThemeMode("dark")}
          className={cn(item, mode === "dark" ? active : inactive)}
          aria-pressed={mode === "dark"}
        >
          <Moon className="size-3.5" />
          Dark
        </button>
      </div>
    </div>
  )
}
