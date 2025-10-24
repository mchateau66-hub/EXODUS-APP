// eslint.config.mjs — Flat config (Next 16 + TypeScript)
import next from 'eslint-config-next'

// On assigne à une variable puis on exporte (évite import/no-anonymous-default-export)
const config = [
  // Fichiers ignorés
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'e2e/**/_snapshots_/**',
      'next-env.d.ts',
      'eslint.config.mjs' // ne pas se lint soi-même si tu fais "eslint ."
    ],
  },

  // Règles officielles Next.js (inclut React + TS de base)
  ...next,

  // Hygiène : aucune alerte bloquante (ton script a --max-warnings=0)
  {
    rules: {
      'no-console': 'off',   // évite d’échouer sur des console.log en CI
      'no-debugger': 'error' // interdit en dur
    }
  }
]

export default config
