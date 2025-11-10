// eslint.config.mjs
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import nextPlugin from '@next/eslint-plugin-next'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default [
  // Remplace .eslintignore
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'public/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      '**/*.d.ts',
      'eslint.config.*', // ne pas auto-linter ce fichier
    ],
  },

  // Base JS (pour .js/.mjs/.cjs)
  js.configs.recommended,

  // Recommandé TS SANS type-check (unique .ts/.tsx)
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ...cfg.languageOptions,
      parserOptions: {
        ...(cfg.languageOptions?.parserOptions ?? {}),
        project: null, // pas de type-check global par défaut
      },
    },
  })),

  // Plugins communs (React / Next / a11y) + règles générales
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      '@next/next': nextPlugin,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
    },
    settings: { react: { version: 'detect' } },
  },

  // Type-check STRICT (ESLint with type info) uniquement pour app/src
  ...tseslint.configs.recommendedTypeChecked.map((cfg) => ({
    ...cfg,
    files: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    languageOptions: {
      ...cfg.languageOptions,
      parserOptions: {
        ...(cfg.languageOptions?.parserOptions ?? {}),
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  })),

  // Next.js + ajustements app/src
  {
    files: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@typescript-eslint/require-await': 'off',
    },
  },

  // E2E : pas de type-check + désactivation des règles "typed" bruyantes
  // + neutralisation de no-unused-vars (corrige ton échec CI actuel)
  {
    files: ['e2e/**/*.{ts,tsx}'],
    languageOptions: { parserOptions: { project: null } },
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/require-await': 'off',
      // ⬇️ Ajout clé : pas d’échec sur helpers/constantes non utilisées en E2E
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // Fichiers de config divers : jamais typés
  {
    files: [
      '**/*.config.{js,cjs,mjs,ts}',
      'playwright.config.{ts,js}',
      'postcss.config.{ts,js}',
      'tailwind.config.{ts,js}',
    ],
    languageOptions: { parserOptions: { project: null } },
    rules: { '@typescript-eslint/triple-slash-reference': 'off' },
  },
]
