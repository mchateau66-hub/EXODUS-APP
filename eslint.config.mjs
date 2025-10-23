// eslint.config.mjs — Flat config (Next 15 + TypeScript)
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Permet d’utiliser les anciens "extends" (config Next officielle)
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // 🔕 D’abord les ignores (ne seront pas lintés)
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "public/**",
      "coverage/**",
      "playwright-report/**",
      "e2e/**/__snapshots__/**",
      "next-env.d.ts",
      // évite l’erreur 'no-require-imports' si un vieux fichier JS traîne
      "playwright.config.js",
    ],
  },

  // ✅ Règles Next + TypeScript recommandées
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // 🎯 Ajustements ciblés pour TS (facultatif mais utile)
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // On garde fort le signal sur 'any'
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];
