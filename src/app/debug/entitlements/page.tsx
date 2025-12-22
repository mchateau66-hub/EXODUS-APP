// src/app/debug/entitlements/page.tsx
import EntitlementsDebug from './EntitlementsDebug'

export const runtime = 'nodejs'

export default function EntitlementsDebugPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow">
        <h1 className="text-base font-semibold text-slate-900">
          Debug entitlements
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Ouvre la console du navigateur pour voir le claim complet.
        </p>

        <div className="mt-4">
          <EntitlementsDebug />
        </div>
      </section>
    </main>
  )
}
