const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  testMatch: /.*\.spec\.(ts|js)$/,
  reporter: 'list',
  use: { baseURL: process.env.BASE_URL || 'http://127.0.0.1:3003' },
  webServer: {
    command: 'pnpm exec next dev --port 3003 --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3003/api/health/live',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
