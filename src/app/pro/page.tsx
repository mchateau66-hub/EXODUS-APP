// src/app/pro/page.tsx
import Link from 'next/link'

export default function ProPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:p-8">
        {/* Badges / intro */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Offre Premium
            </p>
            <h1 className="text-xl font-semibold text-slate-900">
              Continue d&apos;échanger librement avec ton coach
            </h1>
          </div>

          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
            <span className="mr-1 h-2 w-2 rounded-full bg-emerald-500" />
            Messagerie sécurisée coach · athlète
          </span>
        </div>

        <p className="mb-6 text-sm text-slate-600">
          La version gratuite te permet de tester la plateforme et d&apos;échanger un
          nombre limité de messages chaque jour. Avec l&apos;offre Premium, tu
          débloques la messagerie illimitée avec ton coach et une expérience plus fluide.
        </p>

        {/* Comparatif Free vs Premium */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {/* Carte Free */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Offre gratuite
                </h2>
                <p className="text-xs text-slate-500">
                  idéale pour découvrir l&apos;app
                </p>
              </div>
              <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-50">
                Free
              </span>
            </div>

            <ul className="mb-3 space-y-1.5 text-xs">
              <li>• Accès à la messagerie avec ton coach</li>
              <li>• Nombre de messages <span className="font-semibold">limité par jour</span></li>
              <li>• Accès à ton objectif et à ton profil athlète</li>
              <li>• Idéal pour tester la relation avec un coach</li>
            </ul>

            <p className="mt-auto text-[11px] text-slate-500">
              Quand tu atteins la limite, tu peux attendre le lendemain ou passer en
              Premium pour continuer à écrire sans limite.
            </p>
          </div>

          {/* Carte Premium */}
          <div className="flex flex-col rounded-2xl border border-slate-900 bg-slate-900 px-4 py-4 text-sm text-slate-50">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-50">
                  Offre Premium
                </h2>
                <p className="text-xs text-slate-300">
                  pour un suivi sérieux et régulier
                </p>
              </div>
              <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                Recommandé
              </span>
            </div>

            <ul className="mb-4 space-y-1.5 text-xs">
              <li>• <span className="font-semibold">Messages illimités</span> avec ton coach</li>
              <li>• Échanges plus fluides pour ajuster ton programme</li>
              <li>• Meilleure continuité dans le suivi de tes objectifs</li>
              <li>• Accès prioritaire aux prochaines fonctionnalités coach/athlète</li>
            </ul>

            {/* CTA principal — à brancher plus tard sur Stripe / checkout */}
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-amber-300"
            >
              Passer en Premium
            </button>

            <p className="mt-2 text-center text-[11px] text-slate-300">
              Le paiement et l&apos;activation de l&apos;abonnement seront gérés sur une
              page sécurisée (Stripe) dans un second temps.
            </p>
          </div>
        </div>

        {/* Rappel contexte messagerie */}
        <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <p className="mb-1 font-semibold text-slate-900">
            Comment ça marche pour toi, athlète ?
          </p>
          <ul className="space-y-1.5">
            <li>
              1. Tu échanges avec un coach via la messagerie interne (onglet
              &laquo; Messages &raquo;).
            </li>
            <li>
              2. En offre gratuite, un quota limite le nombre de messages par jour
              pour éviter les abus.
            </li>
            <li>
              3. Avec Premium, tu peux écrire autant que nécessaire pour affiner ton
              plan, poser des questions, et suivre ton évolution.
            </li>
          </ul>
        </div>

        {/* Navigations secondaires */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
          <Link
            href="/messages"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
          >
            ← Retour à la messagerie
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-400">
              En continuant, tu acceptes les conditions d&apos;utilisation.
            </span>
            <Link
              href="/legal/terms"
              className="text-[11px] font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              Voir les conditions
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
