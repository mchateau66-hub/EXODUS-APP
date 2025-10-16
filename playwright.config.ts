// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

// extrait conseillé
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  // ...
  use: { baseURL: BASE_URL, /* ... */ },
  webServer: BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1')
    ? {
        command: 'pnpm dev',
        // ping sur la santé, pas sur "/"
        url: `${BASE_URL}${process.env.E2E_SMOKE_PATH || '/api/health'}`,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
