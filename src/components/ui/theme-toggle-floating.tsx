"use client"

import { ThemeToggle } from "@/components/ui/theme-toggle"

export function ThemeToggleFloating() {
  return (
    <div className="fixed bottom-4 right-4 z-50 hidden sm:block">
      <ThemeToggle />
    </div>
  )
}