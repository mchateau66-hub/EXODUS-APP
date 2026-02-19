// src/app/admin/analytics/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-6xl px-8 py-6 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Analytics</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Control Center • DB-first • Admin key protected
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-2">
          <Tab href="/admin/analytics" label="Overview" />
          <Tab href="/admin/analytics/segments" label="Segmentation" />
          <Tab href="/admin/analytics/behavior" label="Behavior" />
          <Tab href="/admin/analytics/pricing-matrix" label="Pricing Matrix" />
          <Tab href="/admin/analytics/paths" label="Paths" />
          {/* next */}
          {/* <Tab href="/admin/analytics/behavior" label="Behavior" /> */}
          {/* <Tab href="/admin/analytics/revenue" label="Revenue" /> */}
        </nav>

        <div>{children}</div>
      </div>
    </div>
  );
}

function Tab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] px-4 py-2 text-sm font-medium hover:bg-[var(--bg-muted)]"
    >
      {label}
    </Link>
  );
}
