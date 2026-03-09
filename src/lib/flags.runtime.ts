// src/lib/flags.runtime.ts
import { getGlobalFlags, FlagKey } from './flags'
import { inCanary } from './canary'

export function isFlagEnabled(flag: FlagKey, userId?: string | null) {
  const flags = getGlobalFlags()

  // toggle global OFF => jamais actif
  if (!flags[flag]) return false

  // canary (par défaut 5% si activé)
  const canaryPct = Number(process.env.CANARY_PERCENT ?? '5')
  const canaryEnabled = process.env.CANARY_ENABLED === '1'

  if (!canaryEnabled) return true
  return inCanary(userId ?? null, canaryPct)
}