"use client"

import * as React from "react"
import { PublicHeader } from "@/components/ui/header"
import { Card } from "@/components/ui/card"

export default function DebugHeaderPage() {
  return (
    <div>
      <PublicHeader />

      <main className="mx-auto w-full max-w-6xl p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">DebugUI — Header</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Scroll pour vérifier sticky + backdrop. Test mobile menu aussi.
          </p>
        </div>

        <div className="grid gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i} padding="lg" variant="default">
              <div className="text-sm font-semibold">Section {i + 1}</div>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Contenu de test pour scroller et valider l’overlay du menu mobile.
              </p>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
