// src/app/(public)/signup/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, FormEvent } from 'react'

type RoleChoice = 'athlete' | 'coach'
type PlanChoice = 'free' | 'premium'

type SignupResponse = {
  ok: boolean
  error?: string
  redirectTo?: string
  checkoutUrl?: string
}

export default function SignupPage() {
  const router = useRouter()

  const [role, setRole] = useState<RoleChoice>('athlete')
  const [plan, setPlan] = useState<PlanChoice>('free')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPremium = plan === 'premium'

  async function submitSignup() {
    setError(null)
    setLoading(true)

    // Mini validation côté client
    if (!email.trim()) {
      setLoading(false)
      setError('Merci de renseigner un email.')
      return
    }

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          plan,
          email: email.trim(),
          name: name.trim() || null,
        }),
      })

      const data = (await res.json().catch(() => null)) as SignupResponse | null

      if (!res.ok || !data) {
        setError(data?.error ?? 'Erreur serveur')
        return
      }

      if (!data.ok) {
        setError(data.error ?? 'Inscription impossible')
        return
      }

      if (data.checkoutUrl) {
        // Cas Premium → Stripe Checkout
        window.location.href = data.checkoutUrl
        return
      }

      if (data.redirectTo) {
        router.push(data.redirectTo)
        return
      }

      // Fallback : on redirige selon le rôle
      router.push(role === 'athlete' ? '/messages' : '/coach')
    } catch {
      setError('Erreur réseau, merci de réessayer.')
    } finally {
      setLoading(false)
    }
  }

  // Handler non async → pas de no-misused-promises
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    void submitSignup()
  }

  const submitLabel = isPremium
    ? role === 'athlete'
      ? 'Continuer vers le paiement Athlète Premium'
      : 'Continuer vers le paiement Coach Premium'
    : role === 'athlete'
      ? 'Créer mon compte Athlète Free'
      : 'Créer mon compte Coach Free'

  return (
    <main className="mx-auto mt-10 flex w-full max-w-xl flex-col gap-6 rounded-2xl border p-6">
      <h1 className="text-2xl font-semibold">Créer mon compte</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Rôle */}
        <section>
          <p className="text-sm font-medium text-slate-700">Je suis…</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole('athlete')}
              className={`rounded-2xl border px-3 py-2 text-sm ${
                role === 'athlete'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300'
              }`}
            >
              Un·e athlète
            </button>
            <button
              type="button"
              onClick={() => setRole('coach')}
              className={`rounded-2xl border px-3 py-2 text-sm ${
                role === 'coach'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300'
              }`}
            >
              Un·e coach
            </button>
          </div>
        </section>

        {/* Plan */}
        <section>
          <p className="text-sm font-medium text-slate-700">Choix d’offre</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPlan('free')}
              className={`rounded-2xl border px-3 py-2 text-sm ${
                plan === 'free'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300'
              }`}
            >
              {role === 'athlete' ? 'Athlète Free' : 'Coach Free'}
            </button>
            <button
              type="button"
              onClick={() => setPlan('premium')}
              className={`rounded-2xl border px-3 py-2 text-sm ${
                plan === 'premium'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300'
              }`}
            >
              {role === 'athlete' ? 'Athlète Premium' : 'Coach Premium'}
            </button>
          </div>
        </section>

        {/* Infos basiques (email / nom) */}
        <section className="grid gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="rounded-2xl border px-3 py-2 text-sm outline-none focus:border-slate-900"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton.email@example.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600" htmlFor="name">
              Prénom / pseudo
            </label>
            <input
              id="name"
              type="text"
              className="rounded-2xl border px-3 py-2 text-sm outline-none focus:border-slate-900"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={role === 'athlete' ? 'Athlète' : 'Coach'}
            />
          </div>
        </section>

        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? 'Traitement…' : submitLabel}
        </button>

        <p className="text-xs text-slate-500">
          En continuant, tu acceptes que l’accès Premium passe par Stripe (mode test / carte 4242… en
          dev).
        </p>
      </form>
    </main>
  )
}
