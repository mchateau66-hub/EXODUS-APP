// src/app/paywall/page.tsx
import React from 'react';

export default function PaywallPage({
  searchParams,
}: {
  searchParams?: { from?: string; paywall?: string };
}) {
  const from = searchParams?.from ?? '/pro';
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

        <div className="text-sm text-gray-500">
          <div>Provenance : <code>{from}</code></div>
          <div>Paywall : <code>{searchParams?.paywall ?? '0'}</code></div>
        </div>
      </section>
    </main>
  );
}
