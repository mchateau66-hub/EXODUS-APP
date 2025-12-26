// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

process.env.SAT_JWT_SECRET ??= "test-secret";

const rawBase = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000").trim();
const baseURL = rawBase.replace(/\/+$/, "");

let parsed: URL;
try {
  parsed = new URL(baseURL);
} catch {
  throw new Error(
    `[playwright] Invalid E2E_BASE_URL="${baseURL}". Must be full URL like https://ton-staging.exodus.app or http://127.0.0.1:3000`,
  );
}

function isLocal(u: URL) {
  const h = u.hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0";
}

function getPort(u: URL) {
  const p = u.port ? Number(u.port) : NaN;
  return Number.isFinite(p) ? p : 3000;
}

const devPort = getPort(parsed);

// ⭐️ IMPORTANT : en CI => webServer UNIQUEMENT si E2E_WEBSERVER=1 (explicite)
// Local dev => webServer ON par défaut (sauf E2E_WEBSERVER=0)
const isCI = !!process.env.CI;
const wsFlag = (process.env.E2E_WEBSERVER ?? "").trim(); // "1" / "0" / ""
const local = isLocal(parsed);

const useWebServer = local && (isCI ? wsFlag === "1" : wsFlag !== "0");
const reuseExistingServer = !isCI;

function toStringEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (typeof v === "string") out[k] = v;
  return out;
}

if (isCI) {
  // log visible dans Actions
  // eslint-disable-next-line no-console
  console.log(
    `[playwright] baseURL=${baseURL} local=${local} E2E_WEBSERVER=${wsFlag || "<unset>"} useWebServer=${useWebServer}`,
  );
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,

  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],

  forbidOnly: isCI,
  retries: isCI ? 2 : 0,

  // staging + shards => éviter 16 workers implicites
  workers: isCI ? (useWebServer ? 4 : 2) : undefined,

  timeout: 60_000,

  use: {
    baseURL,
    trace: "on-first-retry",
    extraHTTPHeaders: { "x-e2e": "1" },
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  ...(useWebServer
    ? {
        webServer: {
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
