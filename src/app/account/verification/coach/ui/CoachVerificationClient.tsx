'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Doc = {
  id: string
  kind: 'diploma' | 'certification' | 'other'
  title: string | null
  url: string
  status: 'pending' | 'verified' | 'needs_review' | 'rejected'
  review_note: string | null
  created_at: string
}

function Badge({ status }: { status: Doc['status'] }) {
  const map: Record<Doc['status'], string> = {
    pending: 'bg-slate-100 text-slate-700',
    verified: 'bg-emerald-100 text-emerald-900',
    needs_review: 'bg-amber-100 text-amber-900',
    rejected: 'bg-rose-100 text-rose-900',
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${map[status]}`}>
      {status}
    </span>
  )
}

export default function CoachVerificationClient() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [kind, setKind] = useState<Doc['kind']>('diploma')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/coach/documents', { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error || `Erreur (${r.status})`)
      setDocs((j.documents ?? []).map((d: any) => ({ ...d, created_at: String(d.created_at) })))
    } catch (e: any) {
      setError(e?.message ?? 'Erreur chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const r = await fetch('/api/coach/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ kind, title: title.trim() || null, url: url.trim() }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error || `Erreur (${r.status})`)
      setTitle('')
      setUrl('')
      await reload()
    } catch (e: any) {
      setError(e?.message ?? 'Erreur ajout')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Supprimer ce document ?')) return
    setError(null)
    try {
      const r = await fetch(`/api/coach/documents/${id}`, {
        method: 'DELETE',
        cache: 'no-store',
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error || `Erreur (${r.status})`)
      await reload()
    } catch (e: any) {
      setError(e?.message ?? 'Erreur suppression')
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Vérification coach</h1>
            <p className="mt-1 text-sm text-slate-600">
              Ajoute tes diplômes/certifs. Statut par document : pending/verified/needs_review.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/hub" className="rounded-full border px-3 py-1.5 text-xs hover:bg-slate-50">
              Hub
            </Link>
            <Link href="/account" className="rounded-full border px-3 py-1.5 text-xs hover:bg-slate-50">
              Mon compte
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Ajouter un document</h2>

        <form onSubmit={onAdd} className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <div className="text-xs font-medium text-slate-700">Type</div>
            <select
              className="w-full rounded-2xl border px-3 py-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
            >
              <option value="diploma">Diplôme</option>
              <option value="certification">Certification</option>
              <option value="other">Autre</option>
            </select>
          </label>

          <label className="space-y-1 md:col-span-1">
            <div className="text-xs font-medium text-slate-700">Titre (optionnel)</div>
            <input
              className="w-full rounded-2xl border px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="BPJEPS, CrossFit L1…"
            />
          </label>

          <label className="space-y-1 md:col-span-1">
            <div className="text-xs font-medium text-slate-700">URL du fichier</div>
            <input
              className="w-full rounded-2xl border px-3 py-2 text-sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              required
            />
          </label>

          <div className="md:col-span-3 flex justify-end">
            <button
              disabled={saving}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-60"
            >
              {saving ? 'Ajout…' : 'Ajouter'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Mes documents</h2>
          <button
            onClick={reload}
            className="rounded-full border px-3 py-1.5 text-xs hover:bg-slate-50"
          >
            Rafraîchir
          </button>
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-slate-600">Chargement…</div>
        ) : docs.length === 0 ? (
          <div className="mt-4 text-sm text-slate-600">Aucun document pour le moment.</div>
        ) : (
          <div className="mt-4 space-y-3">
            {docs.map((d) => (
              <div key={d.id} className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-slate-900">
                        {d.title || d.kind}
                      </div>
                      <Badge status={d.status} />
                    </div>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-xs text-slate-600 underline"
                    >
                      {d.url}
                    </a>
                    {d.review_note ? (
                      <div className="mt-2 text-xs text-slate-700">
                        Note: <span className="text-slate-600">{d.review_note}</span>
                      </div>
                    ) : null}
                  </div>

                  <button
                    onClick={() => onDelete(d.id)}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-800 hover:bg-rose-100"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
