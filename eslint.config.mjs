import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import nextPlugin from '@next/eslint-plugin-next'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default [
  { ignores: [
      'node_modules/**','.next/**','public/**',
      'playwright-report/**','test-results/**',
      'coverage/**','**/*.d.ts','eslint.config.*'
  ]},

  js.configs.recommended,

  ...tseslint.configs.recommended.map(cfg => ({
    ...cfg,
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ...cfg.languageOptions,
      parserOptions: { ...(cfg.languageOptions?.parserOptions ?? {}), project: null },
    },
  })),

  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y, '@next/next': nextPlugin },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_',
      }],
    },
    settings: { react: { version: 'detect' } },
  },

  ...tseslint.configs.recommendedTypeChecked.map(cfg => ({
    ...cfg,
    files: ['src/**/*.{ts,tsx}','app/**/*.{ts,tsx}'],
    languageOptions: {
      ...cfg.languageOptions,
      parserOptions: {
        ...(cfg.languageOptions?.parserOptions ?? {}),
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  })),
  {
    files: ['src/**/*.{ts,tsx}','app/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: { ...nextPlugin.configs['core-web-vitals'].rules, '@typescript-eslint/require-await': 'off' },
  },

  {
    files: ['e2e/**/*.{ts,tsx}'],
    languageOptions: { parserOptions: { project: null } },
    rules: {
      '@typescript-eslint/no-unsafe-assignment':'off',
      '@typescript-eslint/no-unsafe-call':'off',
      '@typescript-eslint/no-unsafe-member-access':'off',
      '@typescript-eslint/no-unsafe-return':'off',
      '@typescript-eslint/no-unsafe-argument':'off',
      '@typescript-eslint/no-explicit-any':'off',
      '@typescript-eslint/await-thenable':'off',
      '@typescript-eslint/no-misused-promises':'off',
      '@typescript-eslint/require-await':'off',
    },
  },

  {
    files: ['**/*.config.{js,cjs,mjs,ts}','playwright.config.{ts,js}','postcss.config.{ts,js}','tailwind.config.{ts,js}'],
    languageOptions: { parserOptions: { project: null } },
    rules: { '@typescript-eslint/triple-slash-reference': 'off' },
  },
]
