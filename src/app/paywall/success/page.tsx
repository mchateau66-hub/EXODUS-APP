// src/app/paywall/success/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function PaywallSuccessPage({
  searchParams,
}: {
  searchParams?: { plan?: string; next?: string };
}) {
  const plan = typeof searchParams?.plan === "string" ? searchParams.plan : "athlete_premium";
  const next = typeof searchParams?.next === "string" ? searchParams.next : "/messages";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-[0_24px_60px_rgba(16,185,129,0.25)] sm:p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          ✓
        </div>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Abonnement activé 🎉</h1>
        <p className="mt-3 text-sm text-slate-600">
          Ton offre Premium est maintenant active. Tu peux échanger sans limite avec ton coach.
        </p>

        <div className="mt-6 flex flex-col items-center gap-2">
          <Link
            href={next}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            Retourner à la messagerie
          </Link>

          <p className="mt-2 text-[11px] text-slate-500">
            Plan actif : <span className="font-medium">{plan}</span>
          </p>
        </div>
      </section>
    </main>
  );
}
