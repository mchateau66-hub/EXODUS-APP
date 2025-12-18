// src/app/signup/page.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, type FormEvent } from 'react'

type Role = 'athlete' | 'coach'
type Plan = 'free' | 'premium'

function safeNext(input: string | null | undefined, fallback = '/hub') {
  if (!input) return fallback
  if (input.startsWith('/') && !input.startsWith('//')) return input
  return fallback
}

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const next = useMemo(() => safeNext(searchParams.get('next'), '/hub'), [searchParams])

  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('athlete')
  const [plan, setPlan] = useState<Plan>('free')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          role,
          plan,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data?.message || data?.error || 'Erreur inscription')
        return
      }

      if (data?.checkoutUrl) {
        window.location.href = String(data.checkoutUrl)
        return
      }

      router.push(safeNext(data?.redirectTo, next))
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-8 space-y-6">
        <h1 className="text-xl font-semibold text-slate-900">Créer un compte</h1>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-800">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-800">Mot de passe</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
            />
            <p className="text-xs text-slate-500">8 caractères minimum.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-800">Je suis</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
              >
                <option value="athlete">Athlète</option>
                <option value="coach">Coach</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-800">Plan</label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as Plan)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
              >
                <option value="free">Free</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>
      </div>
    </main>
  )
}
