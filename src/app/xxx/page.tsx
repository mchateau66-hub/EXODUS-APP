import { Suspense } from 'react'
import XxxClient from './XxxClient'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-500">Chargement…</div>}>
      <XxxClient />
    </Suspense>
  )
}
