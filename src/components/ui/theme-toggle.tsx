"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import {
  applyTheme,
  EXODUS_THEME_STORAGE_KEY,
  readStoredThemeMode,
  type ThemeMode,
} from "@/lib/theme-apply";

export function ThemeToggle() {
  const [mode, setMode] = React.useState<ThemeMode>("system");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const initial = readStoredThemeMode();
    setMode(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted || mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mounted, mode]);

  function updateMode(next: ThemeMode) {
    setMode(next);
    localStorage.setItem(EXODUS_THEME_STORAGE_KEY, next);
    applyTheme(next);
  }

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => updateMode("light")}
        className={`rounded-lg p-2 ${mode === "light" ? "bg-[var(--bg-muted)]" : ""}`}
        aria-pressed={mode === "light"}
        aria-label="Thème clair"
      >
        <Sun className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => updateMode("dark")}
        className={`rounded-lg p-2 ${mode === "dark" ? "bg-[var(--bg-muted)]" : ""}`}
        aria-pressed={mode === "dark"}
        aria-label="Thème sombre"
      >
        <Moon className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => updateMode("system")}
        className={`rounded-lg p-2 ${mode === "system" ? "bg-[var(--bg-muted)]" : ""}`}
        aria-pressed={mode === "system"}
        aria-label="Thème système"
      >
        <Monitor className="h-4 w-4" />
      </button>
    </div>
  );
}
