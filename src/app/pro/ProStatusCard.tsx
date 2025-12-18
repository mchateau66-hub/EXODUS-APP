// src/app/pro/ProStatusCard.tsx
'use client'

import { useEffect, useState } from 'react'

const DEMO_USER_ID = process.env.NEXT_PUBLIC_DEMO_USER_ID

type EntitlementsResponse = {
  plan: string
  features: string[]
  subscription: {
    id: string
    status: string
    current_period_end: string | null
    expires_at: string | null
  } | null
}

type UiState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: EntitlementsResponse }

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function getStatusLabel(data: EntitlementsResponse) {
  const sub = data.subscription

  if (!sub) {
    return {
      label: 'Aucun abonnement Pro',
      tone: 'danger' as const,
      helper: 'Passez à un plan payant pour débloquer les fonctionnalités Pro.',
    }
  }

  const now = Date.now()
  const exp = sub.expires_at ? new Date(sub.expires_at).getTime() : null
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end).getTime()
    : null
  const soonThreshold = now + 7 * 24 * 60 * 60 * 1000 // 7 jours

  if (exp && exp < now) {
    return {
      label: 'Abonnement expiré',
      tone: 'danger' as const,
      helper: 'Renouvelez votre abonnement pour conserver l’accès Pro.',
    }
  }

  if (sub.status === 'canceled' || sub.status === 'unpaid') {
    return {
      label: 'Abonnement inactif',
      tone: 'danger' as const,
      helper:
        'Votre abonnement a été annulé ou suspendu. Vérifiez votre paiement.',
    }
  }

  const isSoon =
    (exp && exp < soonThreshold) || (periodEnd && periodEnd < soonThreshold)

  if (isSoon) {
    return {
      label: 'Actif (expire bientôt)',
      tone: 'warning' as const,
      helper:
        'Votre période actuelle se termine bientôt. Pensez à vérifier votre moyen de paiement.',
    }
  }

  return {
    label: 'Accès Pro actif',
    tone: 'success' as const,
    helper: 'Vous disposez actuellement de l’accès Pro.',
  }
}

function toneClasses(tone: 'success' | 'warning' | 'danger') {
  switch (tone) {
    case 'success':
      return {
        badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
        dot: 'bg-emerald-500',
        border: 'border-emerald-100',
      }
    case 'warning':
      return {
        badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
        dot: 'bg-amber-500',
        border: 'border-amber-100',
      }
    case 'danger':
    default:
      return {
        badge: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
        dot: 'bg-rose-500',
        border: 'border-rose-100',
      }
  }
}

export default function ProStatusCard() {
  const [state, setState] = useState<UiState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!DEMO_USER_ID) {
        setState({
          kind: 'error',
          message:
            'NEXT_PUBLIC_DEMO_USER_ID est manquant dans les variables d’environnement.',
        })
        return
      }

      try {
        const params = new URLSearchParams({ userId: DEMO_USER_ID })
        const res = await fetch(`/api/entitlements?${params.toString()}`, {
          credentials: 'include',
        })

        if (cancelled) return

        if (!res.ok) {
          setState({
            kind: 'error',
            message: `Erreur serveur (${res.status})`,
          })
          return
        }

        const data = (await res.json()) as EntitlementsResponse
        setState({ kind: 'ready', data })
      } catch (e) {
        if (cancelled) return
        setState({
          kind: 'error',
          message: 'Impossible de charger le statut Pro.',
        })
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  if (state.kind === 'loading') {
    return (
      <section className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-5 w-40 rounded bg-slate-100" />
        <div className="mt-4 h-4 w-64 rounded bg-slate-100" />
        <div className="mt-6 h-10 w-full rounded bg-slate-100" />
      </section>
    )
  }

  if (state.kind === 'error') {
    return (
      <section className="rounded-2xl border border-rose-100 bg-rose-50/80 p-6 text-rose-800 shadow-sm">
        <h2 className="text-lg font-semibold">Erreur</h2>
        <p className="mt-2 text-sm">{state.message}</p>
      </section>
    )
  }

  const { data } = state
  const { label, tone, helper } = getStatusLabel(data)
  const styles = toneClasses(tone)

  const expiresAt =
    data.subscription?.expires_at ?? data.subscription?.current_period_end

  return (
    <section
      className={`rounded-2xl border bg-white p-6 shadow-sm ${styles.border}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${styles.badge}`}
          >
            <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
            <span className="uppercase tracking-wide">Espace Pro</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">
            Plan actuel : <span className="capitalize">{data.plan}</span>
          </h2>
          <p className="mt-1 text-sm text-slate-500">{helper}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Expire le
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {formatDate(expiresAt)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Basé sur la date d’expiration de votre abonnement courant.
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Statut d’abonnement
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {data.subscription?.status ?? 'none'}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Valeur directe du champ <code>subscriptions.status</code>.
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Nombre de features actives
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {data.features.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Calculé depuis les entitlements de l’utilisateur.
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-medium text-slate-900">
          Features accordées
        </h3>
        {data.features.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Aucune feature Pro active pour le moment.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {data.features.map((f) => (
              <li
                key={f}
                className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
