import { redirect } from "next/navigation"
import { getUserFromSession } from "@/lib/auth"
import { PublicHeader } from "@/components/ui/header"
import { Hero } from "@/components/public/hero"

export default async function HomePage() {
  const ctx = await getUserFromSession()

  if (ctx?.user) {
    redirect("/hub")
  }

  return (
    <main className="min-h-[100dvh] bg-[var(--bg)] text-[var(--text)]">
      <PublicHeader />
      <Hero />

      <section id="features" className="mx-auto w-full max-w-6xl px-4 py-16 md:py-24">
        <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8 shadow-[var(--card-shadow)]">
          <h2 className="text-2xl font-semibold tracking-tight">Fonctionnalités</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)] md:text-base">
            Messagerie sécurisée, matching coach ↔ athlète, parcours premium, accès contrôlé par entitlements et expérience fluide sur toute la plateforme.
          </p>
        </div>
      </section>

      <section id="pricing" className="mx-auto w-full max-w-6xl px-4 py-16 md:py-24">
        <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8 shadow-[var(--card-shadow)]">
          <h2 className="text-2xl font-semibold tracking-tight">Tarifs</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)] md:text-base">
            Offre claire, sans friction, avec un accès progressif aux fonctionnalités premium selon les besoins du coach ou de l’athlète.
          </p>
        </div>
      </section>

      <section id="faq" className="mx-auto w-full max-w-6xl px-4 py-16 md:py-24">
        <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8 shadow-[var(--card-shadow)]">
          <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)] md:text-base">
            Questions fréquentes sur l’inscription, les échanges, la réservation, la sécurité et les accès premium.
          </p>
        </div>
      </section>
    </main>
  )
}