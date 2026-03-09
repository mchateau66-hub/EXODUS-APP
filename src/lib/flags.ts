// src/lib/flags.ts
export type FlagKey =
  | 'sat'
  | 'pii_guard'
  | 'ocr'
  | 'handoff_premium'
  | 'strict_price_mapping'

type Flags = Record<FlagKey, boolean>

function envOn(name: string, defaultValue = '0') {
  const v = process.env[name] ?? defaultValue
  return v === '1' || v.toLowerCase() === 'true'
}

/**
 * Flags globaux (toggle instantané via variables d'env)
 */
export function getGlobalFlags(): Flags {
  return {
    sat: envOn('FLAG_SAT', '0'),
    pii_guard: envOn('FLAG_PII_GUARD', '0'),
    ocr: envOn('FLAG_OCR', '0'),
    handoff_premium: envOn('FLAG_HANDOFF_PREMIUM', '0'),
    strict_price_mapping: envOn('FLAG_STRICT_PRICE_MAPPING', '1'), // recommandé = ON
  }
}