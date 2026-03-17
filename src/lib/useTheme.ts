"use client"

import * as React from "react"

export type ThemeMode = "system" | "light" | "dark"
export type ResolvedTheme = "light" | "dark"

const STORAGE_KEY = "exodus-theme-mode"

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark"
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? getSystemTheme() : mode
}

function applyTheme(mode: ThemeMode): ResolvedTheme {
  const root = document.documentElement
  const resolved = resolveTheme(mode)
  root.classList.toggle("dark", resolved === "dark")
  root.style.colorScheme = resolved
  return resolved
}

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system"
  const raw = localStorage.getItem(STORAGE_KEY)
  return isThemeMode(raw) ? raw : "system"
}

export function useTheme() {
  const [mode, setMode] = React.useState<ThemeMode>("system")
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>("light")
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    const stored = getStoredTheme()
    setMode(stored)
    setResolvedTheme(applyTheme(stored))
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!mounted) return
    localStorage.setItem(STORAGE_KEY, mode)
    setResolvedTheme(applyTheme(mode))
  }, [mode, mounted])

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const mq = window.matchMedia("(prefers-color-scheme: dark)")

    const onChange = () => {
      if (mode === "system") {
        setResolvedTheme(applyTheme("system"))
      }
    }

    if (mq.addEventListener) mq.addEventListener("change", onChange)
    else mq.addListener(onChange)

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange)
      else mq.removeListener(onChange)
    }
  }, [mode])

  const setThemeMode = React.useCallback((next: ThemeMode) => {
    setMode(next)
  }, [])

  const toggle = React.useCallback(() => {
    setMode((prev) => {
      const currentResolved = prev === "system" ? getSystemTheme() : prev
      return currentResolved === "dark" ? "light" : "dark"
    })
  }, [])

  return {
    mode,
    resolvedTheme,
    setThemeMode,
    toggle,
    mounted,
  }
}