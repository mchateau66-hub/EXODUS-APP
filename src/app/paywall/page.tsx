// src/app/paywall/page.tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'

type PaywallPageProps = {
  searchParams?: {
    next?: string
  }
}

type CheckoutResponse = {
  ok: boolean
  url?: string
  id?: string
  error?: string
  message?: string
}

export default function PaywallPage({ searchParams }: PaywallPageProps) {
  const rawNext = searchParams?.next || '/messages'

  // Petit garde-fou sécurité : on n'autorise que les chemins internes
  const safeNext =
    typeof rawNext === 'string' &&
    rawNext.startsWith('/') &&
    !rawNext.startsWith('//')
      ? rawNext
      : '/messages'

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStartCheckout() {
    if (loading) return
    setError(null)
    setLoading(true)

    try {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : ''

      const successUrl = `${origin}${safeNext}?checkout=success&plan=athlete_premium`
      const cancelUrl = `${origin}/paywall?next=${encodeURIComponent(
        safeNext,
      )}&canceled=1`

      const res = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planKey: 'athlete_premium',
          billingPeriod: 'monthly',
          successUrl,
          cancelUrl,
        }),
      })

      const data = (await res.json().catch(
        () => null,
      )) as CheckoutResponse | null

      if (!res.ok || !data?.ok || !data.url) {
        const msg =
          data?.message ??
          data?.error ??
          `Erreur lors de la création de la session de paiement (code ${res.status}).`
        setError(msg)
        return
      }

      // 🔁 Redirection vers Stripe Checkout
      window.location.href = data.url
    } catch (err) {
      console.error('Erreur /api/checkout/session', err)
      setError(
        "Impossible de démarrer le paiement pour le moment. Réessaie dans un instant.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:p-8">
        {/* En-tête */}
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Messagerie · Limite atteinte
        </p>
        <h1 className="mb-3 text-lg font-semibold text-slate-900">
          Tu as atteint la limite de messages de l&apos;offre gratuite
        </h1>

        <p className="mb-4 text-sm text-slate-600">
          Pour éviter les abus et garder une expérience de qualité pour tout le
          monde, la version gratuite limite le nombre de messages que tu peux
          envoyer à ton coach chaque jour.
        </p>

        {/* Carte résumé Free vs Premium */}
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-slate-900">
                Offre gratuite
              </span>
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-50">
                Free
              </span>
            </div>
            <ul className="space-y-1.5">
              <li>• Accès à la messagerie coach · athlète</li>
              <li>• Nombre de messages limité par jour</li>
              <li>• Idéal pour tester la plateforme</li>
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">
              Tu pourras renvoyer des messages dès demain avec l&apos;offre
              gratuite.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-xs text-slate-50">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-slate-50">
                Offre Premium
              </span>
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-900">
                Recommandé
              </span>
            </div>
            <ul className="space-y-1.5">
              <li>
                • Messagerie{' '}
                <span className="font-semibold">illimitée</span> avec ton coach
              </li>
              <li>• Échanges plus fluides pour ajuster ton programme</li>
              <li>• Meilleure continuité dans le suivi de tes objectifs</li>
            </ul>
            <p className="mt-2 text-[11px] text-slate-300">
              Parfait si tu veux un suivi régulier et pouvoir poser tes
              questions quand tu en as besoin.
            </p>
          </div>
        </div>

        {/* Erreur checkout éventuelle */}
        {error && (
          <div className="mb-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-2 text-[11px] text-red-700">
            {error}
          </div>
        )}

        {/* CTA principaux */}
        <div className="mb-4 space-y-3">
          <button
            type="button"
            onClick={handleStartCheckout}
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-50 shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading
              ? 'Redirection vers le paiement…'
              : "Débloquer l'offre Premium"}
          </button>

          {/* CTA secondaire : retour à la messagerie */}
          <Link
            href={safeNext}
            className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Retourner à la messagerie
          </Link>
        </div>

        {/* Petit texte rassurant */}
        <p className="text-center text-[11px] text-slate-400">
          Le paiement et l&apos;activation de l&apos;offre Premium sont gérés sur une
          page sécurisée via Stripe. Tu pourras revenir à la messagerie une fois
          le paiement validé.
        </p>
      </section>
    </main>
  )
}
