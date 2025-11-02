// eslint.config.mjs — Flat config (ESM)
import next from 'eslint-config-next';

export default [
  // Remplace l'ancien .eslintignore
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
    ],
  },

  // Base Next.js (Flat)
  ...next,

  // Overrides E2E (placé après pour prendre le dessus)
  {
    files: ['e2e/**/*.{ts,tsx}', '**/e2e/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
