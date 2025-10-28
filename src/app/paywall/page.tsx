// src/app/paywall/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Paywall',
  robots: { index: false, follow: false },
}

type PaywallSearch = Promise<{ from?: string; paywall?: string }>

export default async function PaywallPage({
  searchParams,
}: {
  searchParams: PaywallSearch
}) {
  const { from = '/pro', paywall = '1' } = await searchParams

  return (
    <main className="mx-auto max-w-xl p-6">
      <section
        data-testid="paywall"
        className="rounded-2xl border border-gray-200 p-6 shadow-sm"
      >
        <h1 className="text-2xl font-semibold mb-2">Accès réservé</h1>
        <p className="text-gray-600 mb-4">
          Cette zone est <strong>premium</strong>. Connecte-toi ou abonne-toi pour continuer.
        </p>

        <div className="text-sm text-gray-500 space-y-1">
          <div>
            Provenance : <code className="font-mono">{from}</code>
          </div>
          <div>
            Paywall : <code className="font-mono">{paywall}</code>
          </div>
        </div>
      </section>
    </main>
  )
}
