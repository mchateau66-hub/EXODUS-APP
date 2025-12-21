import { Suspense } from 'react'
import MessagesClient from './MessagesClient'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-500">Chargement…</div>}>
      <MessagesClient />
    </Suspense>
  )
}
