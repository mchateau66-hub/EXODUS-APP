'use client'

import dynamic from 'next/dynamic'

type Role = 'athlete' | 'coach' | 'admin'

export type HubMapClientProps = {
  role: Role | string
  defaultCountry?: string | null
  defaultLanguage?: string | null
}

const HubMapLeafletImpl = dynamic(() => import('./HubMapLeafletImpl'), {
  ssr: false,
  loading: () => (
    <div className="h-[460px] w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
      Chargement de la carte…
    </div>
  ),
})

export default function HubMapClient(props: HubMapClientProps) {
  return <HubMapLeafletImpl {...props} />
}
