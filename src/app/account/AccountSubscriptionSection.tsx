// src/app/account/AccountSubscriptionSection.tsx
'use client'

import { Suspense, useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEntitlements } from '@/lib/entitlements'

type Role = 'athlete' | 'coach' | 'admin'
type Props = { role: Role }

export default function AccountSubscriptionSection(props: Props) {
  return (
    <Suspense fallback={null}>
      <AccountSubscriptionSectionInner {...props} />
    </Suspense>
  )
}
type CheckoutResponse = {
  ok: boolean
  url?: string
  id?: string
  error?: string
  message?: string
}

// ... imports ...

function AccountSubscriptionSectionInner({ role }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const { data: claim, loading, error } = useEntitlements()

  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const checkoutStatus = searchParams.get('checkout')
  const checkoutPlan = searchParams.get('plan')

  // 🔑 On force en string pour éviter les histoires de union types
  const rawPlan = claim?.plan
  const planKey = String(rawPlan || 'free')

  const planName =
    planKey === 'master'
      ? 'Abonnement Master'
      : planKey === 'premium'
      ? 'Abonnement Premium'
      : planKey === 'athlete_premium'
      ? 'Athlète Premium'
      : planKey === 'coach_premium'
      ? 'Coach Premium'
      : planKey === 'free'
      ? 'Free'
      : planKey

  const features = claim?.features ?? []

  const isPremium = features.includes('messages.unlimited')

  const premiumTargetPlanKey: 'athlete_premium' | 'coach_premium' | null =
    role === 'athlete'
      ? 'athlete_premium'
      : role === 'coach'
      ? 'coach_premium'
      : null

  const checkoutSuccess =
    checkoutStatus === 'success' && checkoutPlan != null
  const checkoutCanceled =
    checkoutStatus === 'canceled' && checkoutPlan != null

  // ... le reste du composant inchangé ...

  const handleStartCheckout = useCallback(async () => {
    if (!premiumTargetPlanKey) return
    if (checkoutLoading) return

    setCheckoutError(null)
    setCheckoutLoading(true)

    try {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : ''

      const successUrl = `${origin}/account?checkout=success&plan=${premiumTargetPlanKey}`
      const cancelUrl = `${origin}/account?checkout=canceled&plan=${premiumTargetPlanKey}`

      const res = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planKey: premiumTargetPlanKey,
          billingPeriod: 'monthly',
          successUrl,
          cancelUrl,
        }),
      })

      const raw: unknown = await res.json().catch(() => null)
      const data: CheckoutResponse | null =
        raw && typeof raw === 'object' ? (raw as CheckoutResponse) : null

      if (!res.ok || !data?.ok || typeof data.url !== 'string') {
        const msg =
          data?.message ??
          data?.error ??
          `Erreur lors de la création de la session de paiement (code ${res.status}).`
        setCheckoutError(msg)
        return
      }

      window.location.href = data.url
    } catch (err: unknown) {
      console.error(
        'Erreur /api/checkout/session depuis /account',
        err instanceof Error ? err : String(err),
      )
      setCheckoutError(
        "Impossible de démarrer le paiement pour le moment. Réessaie dans un instant.",
      )
    } finally {
      setCheckoutLoading(false)
    }
  }, [premiumTargetPlanKey, checkoutLoading])

  const handleClearCheckoutParams = useCallback(() => {
    const params = new URLSearchParams(
      typeof window !== 'undefined'
        ? window.location.search
        : searchParams.toString(),
    )
    params.delete('checkout')
    params.delete('plan')
    router.replace(`/account?${params.toString()}`, {
      scroll: false,
    })
  }, [router, searchParams])

  const featuresLabel = useMemo(() => {
    if (!claim) return '—'
    if (!features.length) {
      return 'aucune feature premium pour le moment'
    }
    return features.join(', ')
  }, [claim, features])

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
            Abonnement
          </p>
          <h2 className="mt-1 text-sm font-semibold text-slate-900">
            Statut de ton offre
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Plan actuel :{' '}
            <span className="font-medium text-slate-900">
              {planName}
            </span>{' '}
            <span className="text-[10px] text-slate-400">
              ({planKey})
            </span>
          </p>

          {loading && (
            <p className="mt-1 text-[11px] text-slate-400">
              Chargement de tes droits…
            </p>
          )}
          {error && !loading && (
            <p className="mt-1 text-[11px] text-red-700">
              {error}
            </p>
          )}

          {claim && (
            <p className="mt-2 text-[11px] text-slate-500">
              Fonctionnalités actives :{' '}
              <span className="font-mono text-[10px] text-slate-700">
                {featuresLabel}
              </span>
            </p>
          )}
        </div>

        {/* Badge statut + CTA */}
        <div className="flex flex-col items-end gap-2 text-right">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium ${
              isPremium
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-50 text-slate-700 border border-slate-200'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isPremium ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            <span>
              {isPremium ? 'Abonnement actif' : 'Plan Free en cours'}
            </span>
          </div>

          {!isPremium && premiumTargetPlanKey && (
            <button
              type="button"
              onClick={() => {
                void handleStartCheckout()
              }}
              disabled={checkoutLoading}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-semibold text-slate-50 shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {checkoutLoading
                ? 'Redirection vers le paiement…'
                : role === 'coach'
                ? 'Passer sur le plan Coach Premium'
                : 'Passer sur le plan Athlète Premium'}
            </button>
          )}

          {isPremium && (
            <p className="max-w-xs text-[11px] text-slate-500">
              Tu profites déjà des avantages Premium. La gestion avancée de
              l&apos;abonnement (factures, résiliation) sera ajoutée ici plus
              tard.
            </p>
          )}

          {checkoutError && (
            <p className="mt-1 max-w-xs text-[11px] text-red-700">
              {checkoutError}
            </p>
          )}
        </div>
      </div>

      {/* Bandeau retour checkout */}
      {(checkoutSuccess || checkoutCanceled) && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-700">
          {checkoutSuccess && (
            <p className="mb-1 font-semibold text-emerald-700">
              Paiement confirmé ✅
            </p>
          )}
          {checkoutCanceled && (
            <p className="mb-1 font-semibold text-amber-700">
              Paiement annulé
            </p>
          )}
          <p className="mb-2">
            {checkoutSuccess
              ? "Ton abonnement va être activé dans les prochaines secondes. Si tu ne vois pas les changements, recharge la page."
              : "Tu peux relancer le paiement quand tu veux depuis cette page si tu changes d'avis."}
          </p>
          <button
            type="button"
            onClick={handleClearCheckoutParams}
            className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-50"
          >
            OK, masquer ce message
          </button>
        </div>
      )}
    </section>
  )
}
