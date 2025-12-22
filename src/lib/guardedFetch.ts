// src/lib/guardedFetch.ts

export type Plan = 'free' | 'master' | 'premium'

export type FeatureKey =
  | 'contacts.view'
  | 'chat.media'
  | 'messages.unlimited'
  | 'suggestions.unlimited'
  | 'whatsapp.handoff'
  | 'boosts.buy'

async function getSAT(feature: FeatureKey, method: string, path: string) {
  const res = await fetch('/api/sat', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feature, method, path }),
  })

  if (!res.ok) {
    throw new Error('sat_failed')
  }

  return res.json() as Promise<{ token: string; exp: number }>
}

/**
 * guardedFetch — wrapper autour fetch
 * - si init.feature est absent → simple fetch()
 * - si init.feature est présent → récupère un SAT et ajoute le header X-SAT
 */
export async function guardedFetch(
  input: RequestInfo | URL,
  init: (RequestInit & { feature?: FeatureKey }) = {},
): Promise<Response> {
  const url =
    typeof input === 'string' || input instanceof URL
      ? input.toString()
      : input.toString()

  const method = (init.method || 'GET').toUpperCase()

  // Cas simple : pas de feature premium → fetch normal
  if (!init.feature) {
    return fetch(url, init)
  }

  // On extrait juste le path (htu) /api/xxx à partir de l’URL
  const path =
    url.startsWith('http://') || url.startsWith('https://')
      ? new URL(url).pathname
      : url.startsWith('/')
      ? url
      : `/${url}`

  const { token } = await getSAT(init.feature, method, path)

  const headers = new Headers(init.headers as HeadersInit | undefined)
  headers.set('X-SAT', token)

  return fetch(url, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
  })
}
