// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

process.env.SAT_JWT_SECRET ??= "test-secret";

const baseURL = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

function isLocalBase(u: string) {
  return /^(https?:\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/.test(u);
}

function getPortFromBaseURL(u: string) {
  try {
    const parsed = new URL(u);
    const p = parsed.port ? Number(parsed.port) : NaN;
    return Number.isFinite(p) ? p : 3000;
  } catch {
    return 3000;
  }
}

const devPort = getPortFromBaseURL(baseURL);

// ✅ CI peut forcer E2E_WEBSERVER=0
// ✅ Et on ne lance JAMAIS webServer si baseURL est distant
const useWebServer = process.env.E2E_WEBSERVER !== "0" && isLocalBase(baseURL);

// Local: on réutilise le serveur s'il existe déjà. CI: on démarre propre.
const reuseExistingServer = !process.env.CI;

function toStringEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,

  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,

  timeout: 60_000,

  use: {
    baseURL,
    trace: "on-first-retry",
    extraHTTPHeaders: { "x-e2e": "1" },
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  ...(useWebServer
    ? {
        webServer: {
          // ✅ FIX: on lance Next DIRECTEMENT (évite le "--" parasite de pnpm dev)
          // Next accepte -p / --port
          command: `pnpm exec next dev -p ${devPort}`,
          url: baseURL,

          reuseExistingServer,
          timeout: 120_000,

          env: {
            ...toStringEnv(process.env),
            SAT_JWT_SECRET: process.env.SAT_JWT_SECRET ?? "test-secret",
          },

          stdout: "pipe",
          stderr: "pipe",
        },
      }
    : {}),
});
