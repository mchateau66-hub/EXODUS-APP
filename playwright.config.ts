// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
// Mets E2E_WEBSERVER=0 en CI pour ne PAS lancer le dev server.
// En local, laisse vide ou ≠ '0' pour le lancer automatiquement.
const useWebServer = process.env.E2E_WEBSERVER !== '0';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Active seulement lorsqu'on veut lancer un serveur local (pas en CI)
  ...(useWebServer && {
    webServer: {
      command: 'pnpm dev',
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  }),
});
