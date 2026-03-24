/**
 * Thème app : une seule clé localStorage (`exodus-theme-mode`),
 * application via `html.dark` + `color-scheme` (Tailwind `darkMode: 'class'`).
 */

export const EXODUS_THEME_STORAGE_KEY = "exodus-theme-mode";

const LEGACY_THEME_STORAGE_KEY = "theme";

export type ThemeMode = "light" | "dark" | "system";

export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(mode: ThemeMode): "light" | "dark" {
  const root = document.documentElement;
  const resolved = mode === "system" ? getSystemTheme() : mode;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  return resolved;
}

export function readStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";

  const primary = window.localStorage.getItem(EXODUS_THEME_STORAGE_KEY);
  if (primary === "light" || primary === "dark" || primary === "system") {
    return primary;
  }

  const legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
  if (legacy === "light" || legacy === "dark" || legacy === "system") {
    window.localStorage.setItem(EXODUS_THEME_STORAGE_KEY, legacy);
    window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
    return legacy;
  }

  return "system";
}
