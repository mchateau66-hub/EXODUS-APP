"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

const items = [
  { label: "Profil", href: "#profil" },
  { label: "Sécurité", href: "#securite" },
  { label: "Notifications", href: "#notifications" },
  { label: "Préférences", href: "#preferences" },
  { label: "Confidentialité", href: "#confidentialite" },
  { label: "Facturation", href: "#facturation" },
]

export function SettingsSidebar() {
  return (
    <nav
      aria-label="Navigation des paramètres"
      className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 shadow-[var(--card-shadow)]"
    >
      <div className="mb-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        Réglages
      </div>

      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-2xl px-3 py-2 text-sm transition-colors",
              "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 [--tw-ring-offset-color:var(--bg)]"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}