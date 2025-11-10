// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const useWebServer = process.env.E2E_WEBSERVER !== '0'; // CI peut forcer E2E_WEBSERVER=0

export default defineConfig({
  testDir: './e2e',

  // Parallélise les tests à l'intérieur d'un même fichier
  fullyParallel: true,

  // Reporter sobre en local, GitHub+HTML en CI
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  // Sécurité CI + stabilité
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,

  timeout: 60_000,

  use: {
    baseURL,
    trace: 'on-first-retry',
  },

  // Pour l’instant on cible Chromium (rapide). On pourra ajouter firefox/webkit plus tard.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Lance Next.js quand E2E_WEBSERVER != '0'
  ...(useWebServer && {
    webServer: {
      command: 'pnpm dev',
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  }),
});
