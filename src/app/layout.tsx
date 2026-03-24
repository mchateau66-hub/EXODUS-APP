import type { Metadata } from "next"
import "leaflet/dist/leaflet.css"
import "./globals.css"
import { Inter } from "next/font/google"
import Script from "next/script"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Coach App",
  description: "Coaching sportif",
}

const themeInitScript = `
(function () {
  try {
    var key = "exodus-theme-mode";
    var stored = localStorage.getItem(key) || localStorage.getItem("theme");
    var mode =
      stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    var root = document.documentElement;

    function systemDark() {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    var resolved = mode === "system" ? (systemDark() ? "dark" : "light") : mode;

    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.className} suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  )
}
