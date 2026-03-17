"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/lib/useTheme"
import { cn } from "@/lib/utils"

export function ThemeToggle() {
  const { mode, resolvedTheme, setThemeMode, toggle, mounted } = useTheme()
  const ToggleIcon = resolvedTheme === "dark" ? Sun : Moon

  const pill =
    "inline-flex items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-1 shadow-sm"

  const item =
    "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors"

  const active = "bg-[var(--bg-muted)] text-[var(--text)]"
  const inactive = "text-[var(--text-muted)] hover:bg-[var(--bg-muted)]/70"

  if (!mounted) return null

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        iconOnly
        aria-label="Basculer entre clair et sombre"
        onClick={toggle}
      >
        <ToggleIcon />
      </Button>

      <div className={pill} role="group" aria-label="Mode du thème">
        <button
          type="button"
          onClick={() => setThemeMode("system")}
          className={cn(item, mode === "system" ? active : inactive)}
          aria-pressed={mode === "system"}
        >
          <Monitor className="size-3.5" />
          Système
        </button>

        <button
          type="button"
          onClick={() => setThemeMode("light")}
          className={cn(item, mode === "light" ? active : inactive)}
          aria-pressed={mode === "light"}
        >
          <Sun className="size-3.5" />
          Clair
        </button>

        <button
          type="button"
          onClick={() => setThemeMode("dark")}
          className={cn(item, mode === "dark" ? active : inactive)}
          aria-pressed={mode === "dark"}
        >
          <Moon className="size-3.5" />
          Sombre
        </button>
      </div>
    </div>
  )
}