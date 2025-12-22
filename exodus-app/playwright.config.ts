// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'
import fs from "node:fs";
import path from "node:path";
import * as dotenv from "dotenv";

const envE2E = path.resolve(process.cwd(), ".env.e2e");
if (fs.existsSync(envE2E)) {
  dotenv.config({ path: envE2E });
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    timezoneId: 'Europe/Paris',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report' }]]
    : 'list',
})
