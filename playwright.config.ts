// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = (process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`).replace(/\/$/, '');
const SESSION_COOKIE = process.env.E2E_SESSION_COOKIE ?? '';
const SMOKE_PATH = process.env.E2E_SMOKE_PATH ?? '/api/health';

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    timezoneId: 'Europe/Paris',
    locale: 'fr-FR',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    extraHTTPHeaders: SESSION_COOKIE ? { Cookie: SESSION_COOKIE } : undefined,
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Démarre Next.js automatiquement UNIQUEMENT en local
  webServer:
    /localhost|127\.0\.0\.1/.test(BASE_URL)
      ? {
          command: `pnpm exec next dev --port ${PORT} --hostname 127.0.0.1`,
          url: `${BASE_URL}${SMOKE_PATH}`,
          reuseExistingServer: true,
          timeout: 120_000,
        }
      : undefined,
});
