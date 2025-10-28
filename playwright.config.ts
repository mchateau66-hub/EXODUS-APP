// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

/**
 * Base config
 * - E2E_BASE_URL: URL cible (ex: http://127.0.0.1:3000)
 * - E2E_WEBSERVER: si ≠ '0' ET pas en CI → Playwright démarre 'pnpm dev'
 *   (En CI, on NE démarre PAS de webserver ici pour éviter le doublon avec e2e.yml)
 * - E2E_BEARER_TOKEN: injecté en header pour les tests "bearer" quand présent
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000'
const inCI = process.env.CI === 'true'
const runPwWebServer = !inCI && (process.env.E2E_WEBSERVER ?? '1') !== '0'

// Extra headers optionnels (n’ajoute rien si pas de token)
const extraHeaders: Record<string, string> = {}
if (process.env.E2E_BEARER_TOKEN) {
  extraHeaders['authorization'] = `Bearer ${process.env.E2E_BEARER_TOKEN}`
}

export default defineConfig({
  testDir: 'e2e',
  testMatch: ['**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: inCI,
  retries: inCI ? 1 : 0,
  workers: inCI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 5_000 },
  outputDir: 'test-results',

  // 💡 Toujours produire un report HTML (utilisé par l’upload d’artefacts)
  reporter: [
    ['github'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL,                       // permet page.goto('/pro')
    trace: 'on-first-retry',       // traces conservées si échec
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    extraHTTPHeaders: extraHeaders,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // 🔌 Démarrage local (dev) uniquement hors CI pour éviter le double start
  ...(runPwWebServer && {
    webServer: {
      command: 'pnpm dev',
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  }),
})
