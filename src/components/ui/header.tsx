"use client"

import * as React from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useScrollSpy } from "@/hooks/use-scroll-spy"

export type HeaderNavItem = {
  label: string
  href: string
}

export interface PublicHeaderProps {
  brand?: React.ReactNode
  nav?: HeaderNavItem[]
  className?: string
  containerClassName?: string
}

export function PublicHeader({
  brand = (
    <Link href="/" className="inline-flex items-center gap-2">
      <span className="text-sm font-semibold tracking-tight text-[var(--header-fg)]">
        Rencontre
      </span>
      <span className="text-sm font-semibold tracking-tight text-[var(--header-muted)]">
        Coach
      </span>
    </Link>
  ),
  nav = [
    { label: "Fonctionnalités", href: "#features" },
    { label: "Tarifs", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ],
  className,
  containerClassName,
}: PublicHeaderProps) {
  const [open, setOpen] = React.useState(false)

  const sectionIds = React.useMemo(
    () =>
      nav
        .map((item) => item.href)
        .filter((href) => href.startsWith("#"))
        .map((href) => href.slice(1)),
    [nav]
  )

  const activeId = useScrollSpy(sectionIds)

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  React.useEffect(() => {
    const previous = document.body.style.overflow

    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = previous
    }

    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")

    const onChange = () => {
      if (mq.matches) setOpen(false)
    }

    if (mq.addEventListener) mq.addEventListener("change", onChange)
    else mq.addListener(onChange)

    onChange()

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange)
      else mq.removeListener(onChange)
    }
  }, [])

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-[var(--header-border)] bg-[var(--header-bg)] shadow-[var(--header-shadow)] supports-[backdrop-filter]:backdrop-blur-[var(--header-backdrop)]",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3",
          containerClassName
        )}
      >
        <div className="flex min-w-0 items-center gap-3">{brand}</div>

        <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
          {nav.map((item) => {
            const isHash = item.href.startsWith("#")
            const id = isHash ? item.href.slice(1) : null
            const isActive = Boolean(id && activeId === id)

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm transition-[background-color,color,opacity] duration-150",
                  isActive
                    ? "bg-[var(--header-link-hover)] text-[var(--header-fg)]"
                    : "text-[var(--header-muted)] hover:bg-[var(--header-link-hover)] hover:text-[var(--header-fg)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 ring-offset-white dark:ring-offset-slate-950"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />

          <Link href="/login">
            <Button variant="ghost" size="sm">
              Se connecter
            </Button>
          </Link>

          <Link href="/signup">
            <Button variant="primary" size="sm">
              Commencer
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      {open && (
        <>
          <div className="md:hidden">
            <div className="mx-auto w-full max-w-6xl px-4 pb-4">
              <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)]">
                <div className="flex flex-col p-2">
                  {nav.map((item) => {
                    const isActive =
                      item.href.startsWith("#") && activeId === item.href.slice(1)

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

                  <div className="mt-2 grid grid-cols-2 gap-2 p-2">
                    <Link href="/login" onClick={() => setOpen(false)}>
                      <Button className="w-full" variant="secondary" size="sm">
                        Se connecter
                      </Button>
                    </Link>

                    <Link href="/signup" onClick={() => setOpen(false)}>
                      <Button className="w-full" variant="primary" size="sm">
                        Commencer
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Fermer le menu"
            className="fixed inset-0 z-40 bg-black/20 md:hidden"
            onClick={() => setOpen(false)}
          />
        </>
      )}
    </header>
  )
}