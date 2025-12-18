// src/lib/entitlements.ts
'use client'

import { useEffect, useState } from 'react'
import type { FeatureKey, Plan } from './guardedFetch'

export interface EntitlementClaim {
  sub: string
  plan: Plan
  features: FeatureKey[]
  sid: string
  device: string
  iat: number
  exp: number
  jti: string
  ver: number
}

interface UseEntitlementsResult {
  data: EntitlementClaim | null
  loading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Hook principal : charge le "claim" d'entitlements depuis /api/entitlements.
 * - data: null si pas loggé ou pas de droits
 * - loading: état de chargement
 * - error: message d'erreur UI-friendly
 * - refresh: force un reload (utile après un upgrade Stripe)
 */
export function useEntitlements(): UseEntitlementsResult {
  const [data, setData] = useState<EntitlementClaim | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch('/api/entitlements', {
          credentials: 'include',
        })

        if (!res.ok) {
          if (res.status === 401 && !cancelled) {
            // pas loggé → pas d’entitlements
            setData(null)
          } else if (!cancelled) {
            setError(`Erreur entitlements (${res.status})`)
          }
          return
        }

        const json = (await res.json().catch(() => null)) as any
        const maybeClaim = json?.claim ?? json

        if (!cancelled) {
          if (maybeClaim && Array.isArray(maybeClaim.features)) {
            setData(maybeClaim as EntitlementClaim)
          } else {
            setData(null)
          }
        }
      } catch (err) {
        console.error('Erreur /api/entitlements', err)
        if (!cancelled) {
          setError(
            'Impossible de charger vos droits. Certaines fonctionnalités peuvent être limitées.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [nonce])

  const refresh = () => setNonce((n) => n + 1)

  return { data, loading, error, refresh }
}

/* ------------------------------------------------------------------
 * Helpers génériques pour manipuler les features côté client
 * ------------------------------------------------------------------ */

const FEATURE_MESSAGES_UNLIMITED =
  'messages.unlimited' as FeatureKey
const FEATURE_MESSAGES_FREE_TRIAL =
  'messages.free_trial' as FeatureKey
const FEATURE_COACH_UNLIMITED_ATHLETES =
  'coach.unlimited_athletes' as FeatureKey
const FEATURE_COACH_EXTERNAL_APP_LINK =
  'coach.external_app_link' as FeatureKey

/**
 * Vérifie si un claim possède une feature précise.
 */
export function hasFeature(
  claim: EntitlementClaim | null,
  feature: FeatureKey,
): boolean {
  if (!claim) return false
  return claim.features?.includes(feature) ?? false
}

/**
 * Vérifie si un claim possède au moins UNE feature parmi une liste.
 */
export function hasAnyFeature(
  claim: EntitlementClaim | null,
  features: FeatureKey[],
): boolean {
  if (!claim || !Array.isArray(claim.features)) return false
  return features.some((f) => claim.features.includes(f))
}

/**
 * Hook simple pour savoir si l'utilisateur courant possède une feature.
 */
export function useHasFeature(feature: FeatureKey) {
  const { data, loading, error, refresh } = useEntitlements()
  const enabled = hasFeature(data, feature)

  return {
    enabled,
    loading,
    error,
    refresh,
    claim: data,
  }
}

/* ------------------------------------------------------------------
 * Helpers spécialisés : messagerie Athlète
 * ------------------------------------------------------------------ */

/**
 * Retourne l'état des droits pour la messagerie :
 * - hasAccess: trial ou illimité
 * - hasUnlimited: messages.unlimited
 * - hasFreeTrial: messages.free_trial
 */
export function useMessagesEntitlements() {
  const { data, loading, error, refresh } = useEntitlements()

  const hasUnlimited = hasFeature(
    data,
    FEATURE_MESSAGES_UNLIMITED,
  )
  const hasFreeTrial = hasFeature(
    data,
    FEATURE_MESSAGES_FREE_TRIAL,
  )

  const hasAccess = hasUnlimited || hasFreeTrial

  return {
    claim: data,
    hasAccess,
    hasUnlimited,
    hasFreeTrial,
    loading,
    error,
    refresh,
  }
}

/**
 * Hook raccourci : est-ce que l'utilisateur peut utiliser la messagerie ?
 * (trial ou illimité)
 */
export function useHasMessagesAccess() {
  const { hasAccess, loading, error, refresh, claim } =
    useMessagesEntitlements()
  return { hasAccess, loading, error, refresh, claim }
}

/**
 * Hook raccourci : est-ce que l'utilisateur a les messages illimités ?
 */
export function useHasUnlimitedMessages() {
  const { hasUnlimited, loading, error, refresh, claim } =
    useMessagesEntitlements()
  return { hasUnlimited, loading, error, refresh, claim }
}

/* ------------------------------------------------------------------
 * Helpers spécialisés : droits coach (côté UI)
 * ------------------------------------------------------------------ */

/**
 * Retourne l'état des droits du coach pour son plan :
 * - canHaveUnlimitedAthletes
 * - canUseExternalAppLink
 */
export function useCoachEntitlements() {
  const { data, loading, error, refresh } = useEntitlements()

  const canHaveUnlimitedAthletes = hasFeature(
    data,
    FEATURE_COACH_UNLIMITED_ATHLETES,
  )

  const canUseExternalAppLink = hasFeature(
    data,
    FEATURE_COACH_EXTERNAL_APP_LINK,
  )

  return {
    claim: data,
    canHaveUnlimitedAthletes,
    canUseExternalAppLink,
    loading,
    error,
    refresh,
  }
}

/**
 * Hook raccourci : est-ce que le coach peut avoir des athlètes illimités ?
 */
export function useCoachHasUnlimitedAthletes() {
  const {
    canHaveUnlimitedAthletes,
    loading,
    error,
    refresh,
    claim,
  } = useCoachEntitlements()

  return {
    canHaveUnlimitedAthletes,
    loading,
    error,
    refresh,
    claim,
  }
}

/**
 * Hook raccourci : est-ce que le coach peut afficher un lien externe (WhatsApp, app…) ?
 */
export function useCoachHasExternalAppLink() {
  const {
    canUseExternalAppLink,
    loading,
    error,
    refresh,
    claim,
  } = useCoachEntitlements()

  return {
    canUseExternalAppLink,
    loading,
    error,
    refresh,
    claim,
  }
}
