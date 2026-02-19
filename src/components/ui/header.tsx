"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import { useScrollSpy } from "@/hooks/use-scroll-spy"

export type HeaderNavItem = {
  label: string
  href: string
}

export interface PublicHeaderProps {
  brand?: React.ReactNode
  nav?: HeaderNavItem[]
  rightSlot?: React.ReactNode
  className?: string
  containerClassName?: string
}

/**
 * PublicHeader — Minimaliste
 * - Sticky + backdrop (token-driven)
 * - Scroll-spy active link
 * - Accessible (nav + aria)
 * - Mobile menu simple (no lib)
 */
export function PublicHeader({
  brand = (
    <Link href="/" className="inline-flex items-center gap-2">
      <span className="text-sm font-semibold tracking-tight">Rencontre</span>
      <span className="text-sm font-semibold tracking-tight text-[var(--header-muted)]">
        Coach
      </span>
    </Link>
  ),
  nav = [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "/#pricing?plan=standard" },
    { label: "FAQ", href: "#faq" },
  ],
  rightSlot,
  className,
  containerClassName,
}: PublicHeaderProps) {
  const [open, setOpen] = React.useState(false)

  const sectionIds = React.useMemo(
    () =>
      nav
        .map((n) => n.href)
        .filter((h) => h.startsWith("#"))
        .map((h) => h.replace("#", "")),
    [nav]
  )

  const activeId = useScrollSpy(sectionIds)

  // Close mobile menu on Escape
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // Lock scroll when mobile menu is open
  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Close mobile menu when switching to desktop breakpoint
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const onChange = () => {
      if (mq.matches) setOpen(false)
    }
    onChange()
    mq.addEventListener?.("change", onChange)
    return () => mq.removeEventListener?.("change", onChange)
  }, [])

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full",
        "border-b border-[var(--header-border)]",
        "bg-[var(--header-bg)] shadow-[var(--header-shadow)]",
        "supports-[backdrop-filter]:backdrop-blur-[var(--header-backdrop)]",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3",
          containerClassName
        )}
      >
        {/* Brand */}
        <div className="flex min-w-0 items-center gap-3 text-[var(--header-fg)]">
          {brand}
        </div>

        {/* Desktop nav */}
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {nav.map((item) => {
            const isHash = item.href.startsWith("#")
            const id = isHash ? item.href.replace("#", "") : null
            const isActive = id ? activeId === id : false

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm",
                  "transition-[background-color,color,opacity] duration-150",
                  isActive
                    ? "bg-[var(--header-link-hover)] text-[var(--header-fg)]"
                    : "text-[var(--header-muted)] hover:bg-[var(--header-link-hover)] hover:text-[var(--header-fg)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2",
                  "ring-offset-white dark:ring-offset-slate-950"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2">
          {rightSlot ?? (
            <>
              <Button variant="ghost" size="sm">
                Se connecter
              </Button>
              <Button variant="primary" size="sm">
                Commencer
              </Button>
            </>
          )}

          {/* Mobile toggle */}
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {open ? (
        <div className="md:hidden">
          <div className="mx-auto w-full max-w-6xl px-4 pb-4">
            <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
              <div className="flex flex-col p-2">
                {nav.map((item) => {
                  const isActive =
                    item.href.startsWith("#") &&
                    activeId === item.href.replace("#", "")

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "rounded-xl px-3 py-2 text-sm transition-[background-color,opacity,color] duration-150",
                        isActive
                          ? "bg-[var(--header-link-hover)] text-[var(--header-fg)]"
                          : "text-[var(--header-fg)] hover:bg-[var(--header-link-hover)]"
                      )}
                    >
                      {item.label}
                    </Link>
                  )
                })}

                <div className="mt-2 flex gap-2 p-2">
                  <Button
                    className="flex-1"
                    variant="secondary"
                    size="sm"
                    onClick={() => setOpen(false)}
                  >
                    Se connecter
                  </Button>
                  <Button
                    className="flex-1"
                    variant="primary"
                    size="sm"
                    onClick={() => setOpen(false)}
                  >
                    Commencer
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* overlay */}
          <button
            aria-label="Fermer"
            className="fixed inset-0 -z-10 bg-black/10"
            onClick={() => setOpen(false)}
          />
        </div>
      ) : null}
    </header>
  )
}
