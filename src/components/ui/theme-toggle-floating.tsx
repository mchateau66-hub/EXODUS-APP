"use client"

import { ThemeToggle } from "@/components/ui/theme-toggle"

export function ThemeToggleFloating() {
  return (
    <div className="fixed top-4 right-4 z-[9999]">
      <ThemeToggle />
    </div>
  )
}
