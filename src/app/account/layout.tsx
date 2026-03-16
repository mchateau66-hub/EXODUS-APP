import { ReactNode } from "react";
import { AccountSidebar } from "./ui/AccountSidebar";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Compte & paramètres</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Gérez votre profil, votre sécurité, vos préférences et votre abonnement.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <AccountSidebar />
        </aside>

        <section className="min-w-0">
          {children}
        </section>
      </div>
    </main>
  );
}