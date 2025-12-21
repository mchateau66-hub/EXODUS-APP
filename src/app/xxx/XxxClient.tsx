'use client'

import { useSearchParams } from 'next/navigation'

export default function XxxClient() {
  const sp = useSearchParams()
  const demo = sp.get('demo')

  return (
    <div className="p-4 text-sm text-slate-600">
      demo: <span className="font-mono">{demo ?? '—'}</span>
    </div>
  )
}
