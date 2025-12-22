'use client'

import { useEffect } from 'react'
import { useEntitlements } from '@/lib/entitlements'

export default function EntitlementsDebug() {
  const { data, loading, error } = useEntitlements()

  // 🔍 Log à chaque render (super visible)
  console.log('🔎 Debug entitlements render =>', {
    loading,
    error,
    data,
  })

  // 🔍 Log spécifique quand on a fini de charger
  useEffect(() => {
    if (!loading) {
      console.log('🧾 Entitlement claim final :', data)
    }
  }, [loading, data])

  return (
    <div className="text-xs text-slate-700">
      <p>Debug entitlements :</p>
      {loading && <p>Chargement...</p>}
      {error && <p>Erreur : {error}</p>}
      {!loading && !error && (
        <pre className="mt-2 rounded bg-slate-100 p-2">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}
