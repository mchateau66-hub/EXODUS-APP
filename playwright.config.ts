import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const useWebServer = process.env.E2E_WEBSERVER !== '0'; // ← CI=0 -> pas de webServer

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Active seulement quand on veut lancer un serveur local
  ...(useWebServer && {
    webServer: {
      command: 'pnpm dev',
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120_000,
    }
  }),
});
