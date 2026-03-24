import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { SettingsSidebar } from "@/components/account/settings/settings-sidebar"

export type SettingsShellProps = {
  children: React.ReactNode
  /** Libellé optionnel sous le titre (ex. email) */
  subtitle?: string
  /** Résumé lecture seule sous l’en-tête (aperçu) */
  summary?: React.ReactNode
  className?: string
}

/**
 * Layout page paramètres : fond tokens, en-tête, résumé optionnel, sidebar + contenu.
 */
export function SettingsShell({ children, subtitle, summary, className }: SettingsShellProps) {
  return (
    <main
      className={cn(
        "min-h-[100dvh] bg-[var(--bg)] text-[var(--text)]",
        className,
      )}
    >
      <header className="border-b border-[var(--border)] bg-[var(--bg-elev)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-[var(--text)]">
                Paramètres
              </h1>
            </div>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">{subtitle}</p>
            ) : null}
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/account"
              className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-muted)]"
            >
              Mon compte
            </Link>
            <Link
              href="/hub"
              className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-transparent px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
            >
              Hub
            </Link>
          </nav>
        </div>
      </header>

      {summary ? (
        <div className="mx-auto w-full max-w-6xl px-4 pb-2 pt-2 md:pb-4">{summary}</div>
      ) : null}

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:flex-row md:items-start md:gap-10 lg:gap-12">
        <SettingsSidebar />
        <div className="min-w-0 flex-1 space-y-8 md:space-y-10">{children}</div>
      </div>
    </main>
  )
}
