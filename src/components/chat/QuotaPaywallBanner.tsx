// src/components/QuotaPaywallBanner.tsx
'use client'

import Link from 'next/link'

type Props = {
  limit: number
}

export default function QuotaPaywallBanner({ limit }: Props) {
  return (
    <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em]">
        Limite quotidienne atteinte
      </p>
      <p className="mb-2 text-[12px] leading-relaxed">
        Tu as atteint la limite de{' '}
        <span className="font-semibold">{limit} messages</span> aujourd&apos;hui
        avec la version gratuite.
        <br />
        Passe en version <span className="font-semibold">Premium</span> pour
        envoyer des messages illimités à ton coach.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/pro"
          className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-slate-800"
        >
          Découvrir l&apos;offre Premium
        </Link>
        <span className="text-[11px] text-amber-800/80">
          Tu pourras réutiliser la messagerie dès demain avec l&apos;offre
          gratuite.
        </span>
      </div>
    </div>
  )
}
