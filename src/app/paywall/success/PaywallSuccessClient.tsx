'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function PaywallSuccessClient() {
  return (
    <Suspense fallback={null}>
      <PaywallSuccessInner />
    </Suspense>
  )
}

type Mode = 'success' | 'canceled' | 'pending'

function PaywallSuccessInner() {
  const router = useRouter()
  const sp = useSearchParams()

  // ✅ Compatible avec ton /account?checkout=success&plan=...
  const checkout = sp.get('checkout') ?? sp.get('status')
  const plan = sp.get('plan') ?? sp.get('planKey') ?? sp.get('price') ?? null

  const mode: Mode = useMemo(() => {
    const v = (checkout ?? '').toLowerCase()
    if (v === 'success' || v === 'succeeded' || v === 'paid') return 'success'
    if (v === 'canceled' || v === 'cancelled' || v === 'cancel') return 'canceled'
    return 'pending'
  }, [checkout])

  // Petit confort : force un refresh (utile si tu as des server components
  // qui lisent les entitlements côté server)
  useEffect(() => {
    router.refresh()
  }, [router])

  // Auto-redirect soft quand succès (optionnel)
  const [countdown, setCountdown] = useState(6)
  useEffect(() => {
    if (mode !== 'success') return

    setCountdown(6)
    const t = setInterval(() => setCountdown((s) => Math.max(0, s - 1)), 1000)
    const to = setTimeout(() => {
      const qs = new URLSearchParams()
      qs.set('checkout', 'success')
      if (plan) qs.set('plan', plan)
      router.replace(`/account?${qs.toString()}`)
    }, 6000)

    return () => {
      clearInterval(t)
      clearTimeout(to)
    }
  }, [mode, router, plan])

  const title =
    mode === 'success'
      ? 'Paiement confirmé ✅'
      : mode === 'canceled'
        ? 'Paiement annulé'
        : 'Traitement du paiement…'

  const subtitle =
    mode === 'success'
      ? "Ton abonnement va être activé dans les prochaines secondes."
      : mode === 'canceled'
        ? "Aucun paiement n'a été effectué. Tu peux relancer quand tu veux."
        : "Si tu viens de payer, attends quelques secondes. Sinon, retourne à ton compte."

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
          Paywall
        </p>

        <h1 className="mt-2 text-lg font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{subtitle}</p>

        {plan ? (
          <p className="mt-3 text-xs text-slate-500">
            Plan : <span className="font-mono text-[11px] text-slate-700">{plan}</span>
          </p>
        ) : null}

        {mode === 'success' ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] text-emerald-800">
            Redirection vers ton compte dans <span className="font-semibold">{countdown}s</span>…
            <div className="mt-2">
              <button
                type="button"
                onClick={() => {
                  const qs = new URLSearchParams()
                  qs.set('checkout', 'success')
                  if (plan) qs.set('plan', plan)
                  router.replace(`/account?${qs.toString()}`)
                }}
                className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-50"
              >
                Aller au compte maintenant
              </button>
            </div>
          </div>
        ) : null}

        {mode === 'canceled' ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] text-amber-900">
            Tu peux relancer le paiement depuis la page compte.
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-[11px] font-semibold text-slate-50 hover:bg-slate-800"
          >
            Retour au compte
          </Link>

          <Link
            href="/hub"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-900 hover:bg-slate-50"
          >
            Aller au hub
          </Link>
        </div>

        <p className="mt-4 text-[11px] text-slate-400">
          Si rien ne change après 30 secondes, recharge la page compte.
        </p>
      </div>
    </main>
  )
}
