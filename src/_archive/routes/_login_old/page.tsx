// src/app/login/page.tsx
'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'

function sanitizeNext(next: string | null) {
  // évite les open-redirects (//evil.com)
  if (!next) return '/hub'
  if (!next.startsWith('/')) return '/hub'
  if (next.startsWith('//')) return '/hub'
  return next
}

function humanizeLoginError(code: unknown) {
  const c = typeof code === 'string' ? code : ''
  if (c === 'invalid_credentials') return 'Email ou mot de passe incorrect.'
  if (c === 'account_disabled') return 'Compte désactivé.'
  if (c === 'email_required') return 'Email manquant.'
  if (c === 'password_required') return 'Mot de passe manquant.'
  if (c === 'server_error') return 'Erreur serveur.'
  return 'Erreur de connexion.'
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const next = useMemo(() => sanitizeNext(searchParams.get('next')), [searchParams])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setError(humanizeLoginError(data?.error))
        setLoading(false)
        return
      }

      const redirectTo = sanitizeNext((data?.redirectTo as string) ?? next)
      router.push(redirectTo)
    } catch (err) {
      console.error('Erreur /api/login', err)
      setError('Erreur réseau')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-sm font-medium text-slate-500">Connexion</div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 space-y-6">
          <header className="space-y-2">
            <h1 className="text-xl font-semibold text-slate-900">
              Connexion à votre compte
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Connectez-vous pour accéder directement au hub.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-slate-800">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@exemple.com"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-800"
              >
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition"
              />
              <div className="flex items-center justify-between">
                <span />
                <Link
                  href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`}
                  className="text-xs text-slate-600 hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
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
              className="w-full inline-flex items-center justify-center rounded-xl bg-slate-900 text-white text-sm font-medium px-4 py-2.5 shadow-sm hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>
              Redirection :{' '}
              <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                {next}
              </code>
            </span>
            <Link href="/signup" className="text-slate-700 hover:underline">
              Créer un compte
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
