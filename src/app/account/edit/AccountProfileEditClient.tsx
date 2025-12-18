'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Profile = {
  name: string
  age: number | null
  country: string
  language: string
  avatarUrl: string
  bio: string
  keywords: string[]
  theme: 'system' | 'light' | 'dark'
}

function normalizeProfile(payload: any): Profile {
  const p = payload?.profile ?? payload?.data ?? payload?.user ?? payload ?? {}
  return {
    name: String(p?.name ?? ''),
    age: typeof p?.age === 'number' ? p.age : p?.age ? Number(p.age) : null,
    country: String(p?.country ?? ''),
    language: String(p?.language ?? 'fr'),
    avatarUrl: String(p?.avatarUrl ?? ''),
    bio: String(p?.bio ?? ''),
    keywords: Array.isArray(p?.keywords) ? p.keywords.map(String) : [],
    theme: (p?.theme === 'dark' || p?.theme === 'light' || p?.theme === 'system')
      ? p.theme
      : 'system',
  }
}

export default function AccountProfileEditClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [form, setForm] = useState<Profile>({
    name: '',
    age: null,
    country: '',
    language: 'fr',
    avatarUrl: '',
    bio: '',
    keywords: [],
    theme: 'system',
  })

  const keywordsText = useMemo(() => form.keywords.join(', '), [form.keywords])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const r = await fetch('/api/onboarding/step-3', { method: 'GET', cache: 'no-store' })
        if (!r.ok) throw new Error(`GET /api/onboarding/step-3 failed (${r.status})`)
        const data = await r.json().catch(() => ({}))
        if (!alive) return
        setForm(normalizeProfile(data))
      } catch (e: any) {
        if (!alive) return
        setError(e?.message ?? 'Erreur chargement profil')
      } finally {
        if (!alive) return
        setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const payload = {
        ...form,
        keywords: keywordsText
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
      }

      const r = await fetch('/api/onboarding/step-3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(payload),
      })

      if (!r.ok) {
        const txt = await r.text().catch(() => '')
        throw new Error(txt || `POST /api/onboarding/step-3 failed (${r.status})`)
      }

      setOk('Profil mis à jour ✅')
      router.refresh()
      // On revient sur la page compte (au lieu de /hub)
      router.push('/account')
    } catch (e: any) {
      setError(e?.message ?? 'Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        Chargement…
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Informations profil</h2>
        <p className="text-xs text-slate-500">
          On réutilise l’API step-3 (sanitize/canon côté serveur).
        </p>
      </div>

      {error ? (
        <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      {ok ? (
        <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {ok}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <div className="text-xs font-medium text-slate-700">Nom</div>
            <input
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))}
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs font-medium text-slate-700">Âge</div>
            <input
              type="number"
              min={0}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              value={form.age ?? ''}
              onChange={(e) =>
                setForm(s => ({ ...s, age: e.target.value === '' ? null : Number(e.target.value) }))
              }
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs font-medium text-slate-700">Pays</div>
            <input
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              value={form.country}
              onChange={(e) => setForm(s => ({ ...s, country: e.target.value }))}
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs font-medium text-slate-700">Langue</div>
            <input
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              value={form.language}
              onChange={(e) => setForm(s => ({ ...s, language: e.target.value }))}
              placeholder="fr"
            />
          </label>
        </div>

        <label className="space-y-1">
          <div className="text-xs font-medium text-slate-700">Avatar (URL) — temporaire</div>
          <input
            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            value={form.avatarUrl}
            onChange={(e) => setForm(s => ({ ...s, avatarUrl: e.target.value }))}
            placeholder="https://…"
          />
        </label>

        <label className="space-y-1">
          <div className="text-xs font-medium text-slate-700">Bio</div>
          <textarea
            className="min-h-[140px] w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            value={form.bio}
            onChange={(e) => setForm(s => ({ ...s, bio: e.target.value }))}
          />
        </label>

        <label className="space-y-1">
          <div className="text-xs font-medium text-slate-700">Mots-clés (séparés par virgules)</div>
          <input
            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            value={keywordsText}
            onChange={(e) =>
              setForm(s => ({
                ...s,
                keywords: e.target.value.split(',').map(x => x.trim()).filter(Boolean),
              }))
            }
            placeholder="motivation, nutrition, performance…"
          />
        </label>

        <label className="space-y-1">
          <div className="text-xs font-medium text-slate-700">Thème</div>
          <select
            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            value={form.theme}
            onChange={(e) => setForm(s => ({ ...s, theme: e.target.value as any }))}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/account')}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:border-slate-400"
          >
            Annuler
          </button>
        </div>
      </form>
    </section>
  )
}
