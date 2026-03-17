import * as React from "react"
import { cn } from "@/lib/utils"

export interface SettingsSectionCardProps {
  id: string
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function SettingsSectionCard({
  id,
  title,
  description,
  children,
  className,
}: SettingsSectionCardProps) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-[var(--card-shadow)] md:p-8",
        className
      )}
    >
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            {description}
          </p>
        ) : null}
      </div>

      {children}
    </section>
  )
}