"use client"

import * as React from "react"

export type ThemeMode = "system" | "light" | "dark"
export type ResolvedTheme = "light" | "dark"

const STORAGE_KEY = "theme"

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light"
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  const resolved: ResolvedTheme = mode === "system" ? getSystemTheme() : mode
  root.classList.toggle("dark", resolved === "dark")
  return resolved
}

export function useTheme() {
  const [mode, setMode] = React.useState<ThemeMode>("system")
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>("light")

  // Init: lire localStorage + appliquer sur <html>
  React.useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? "system"
    setMode(stored)
    setResolvedTheme(applyTheme(stored))
  }, [])

  // Quand mode change: sauver + appliquer
  React.useEffect(() => {
    // évite d’écraser au premier render avant init
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEY, mode)
    setResolvedTheme(applyTheme(mode))
  }, [mode])

  // Écoute les changements système si mode === "system"
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)")
    if (!mq) return

    const onChange = () => {
      if (mode === "system") setResolvedTheme(applyTheme("system"))
    }

    // compat safari
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
    // toggle basé sur le thème résolu (si system->dark => toggle vers light, etc.)
    setMode((prev) => {
      const currentResolved = prev === "system" ? getSystemTheme() : prev
      return currentResolved === "dark" ? "light" : "dark"
    })
  }, [])

  return { mode, resolvedTheme, setThemeMode, toggle }
}
