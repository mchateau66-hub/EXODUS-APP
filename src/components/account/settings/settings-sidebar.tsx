"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type SettingsNavItem = {
  id: string
  label: string
}

const DEFAULT_ITEMS: SettingsNavItem[] = [
  { id: "profile", label: "Profil" },
  { id: "security", label: "Sécurité" },
  { id: "notifications", label: "Notifications" },
  { id: "preferences", label: "Préférences" },
  { id: "privacy", label: "Confidentialité" },
  { id: "billing", label: "Abonnement" },
  { id: "usage", label: "Usage" },
]

export type SettingsSidebarProps = {
  items?: SettingsNavItem[]
  className?: string
}

/**
 * Navigation par ancres — mobile : scroll horizontal ; desktop : colonne sticky.
 */
export function SettingsSidebar({ items = DEFAULT_ITEMS, className }: SettingsSidebarProps) {
  const [active, setActive] = React.useState<string | null>(items[0]?.id ?? null)

  React.useEffect(() => {
    const ids = items.map((i) => i.id)
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el))

    if (els.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target?.id) setActive(visible.target.id)
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.1, 0.25, 0.5, 1] },
    )

    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [items])

  return (
    <aside
      className={cn(
        "w-full shrink-0 md:sticky md:top-24 md:w-52 lg:w-56",
        className,
      )}
    >
      <nav aria-label="Sections des paramètres" className="md:rounded-[var(--radius-lg)] md:border md:border-[var(--border)] md:bg-[var(--bg-elev)] md:p-2">
        <p className="mb-2 hidden px-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)] md:block">
          Sections
        </p>
        <ul className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:flex-col md:gap-0 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const isActive = active === item.id
            return (
              <li key={item.id} className="shrink-0 md:shrink">
                <a
                  href={`#${item.id}`}
                  className={cn(
                    "block whitespace-nowrap rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
                    isActive
                      ? "bg-[var(--bg-muted)] font-medium text-[var(--text)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]",
                  )}
                >
                  {item.label}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
