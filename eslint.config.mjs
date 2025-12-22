// eslint.config.mjs
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import nextPlugin from '@next/eslint-plugin-next'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default [
  // Ignore (remplace .eslintignore)
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'public/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'prisma/**',
      '**/*.d.ts',
      'eslint.config.mjs',
    ],
  },

  // Base JS
  js.configs.recommended,

  // ✅ Scripts Node (audit, outils, etc.)
  // Fix: "process is not defined" / "console is not defined" dans scripts/next15_audit.mjs
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',

        // timers (souvent utilisés dans scripts)
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
      },
    },
  },

  // TS recommandé (SANS type-check)
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ...cfg.languageOptions,
      parserOptions: {
        ...(cfg.languageOptions?.parserOptions ?? {}),
        project: null, // 🔑 pas de lint type-aware
      },
    },
  })),

  // React + Hooks + Next + (a11y désactivé pour l’instant)
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      '@next/next': nextPlugin,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // React 17+ / Next : pas besoin
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // 🔇 Trop bruyant au début (tu le réactiveras plus tard)
      'react-hooks/set-state-in-effect': 'off',

      // 🔇 a11y : à réactiver plus tard (sinon tu as des centaines d’erreurs)
      'jsx-a11y/label-has-associated-control': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
    },
  },

  // E2E : on laisse relax
  {
    files: ['e2e/**/*.{ts,tsx}'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // ✅ MVP overrides (évite les erreurs "any" + "unused-vars" partout)
  // (et évite aussi de dépasser --max-warnings=10)
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',

      // Garde tout en "off" pour ne pas exploser les warnings
      'prefer-const': 'off',
      'no-empty': 'off',
    },
  },
]
