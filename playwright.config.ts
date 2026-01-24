// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".e2e.local.env" });

if (!process.env.SAT_JWT_SECRET?.trim()) {
  process.env.SAT_JWT_SECRET = "test-secret";
}

function normalizeBaseUrl(u: string) {
  return (u || "http://127.0.0.1:3000").trim().replace(/\/+$/, "");
}

function isLocalBase(u: string) {
  try {
    const { hostname } = new URL(u);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname.toLowerCase());
  } catch {
    return true;
  }
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

function toStringEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (typeof v === "string") out[k] = v;
  return out;
}

const rawBaseURL = normalizeBaseUrl(process.env.E2E_BASE_URL || "http://127.0.0.1:3000");
const local = isLocalBase(rawBaseURL);
const devPort = getPortFromBaseURL(rawBaseURL);

// 👉 en local on force 127.0.0.1 (cookies host-only stables)
const localURL = `http://127.0.0.1:${devPort}`;
const baseURL = local ? localURL : rawBaseURL;

// Aligne aussi l'env pour helpers.ts + global-setup.ts
if (local) process.env.E2E_BASE_URL = baseURL;

// Démarrer Next en local seulement si PW_WEB_SERVER=1
const startWebServer = local && (process.env.PW_WEB_SERVER ?? "").trim() === "1";

// ✅ En LOCAL: pas de x-e2e global (ça pollue /api/login et page.request)
// ✅ En REMOTE: x-e2e + bypass + token
const extraHeaders: Record<string, string> = {};

if (!local) {
  extraHeaders["x-e2e"] = "1";

  const e2eToken = (process.env.E2E_DEV_LOGIN_TOKEN ?? "").trim();
  if (e2eToken) extraHeaders["x-e2e-token"] = e2eToken;

  const vercelBypass = (process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "").trim();
  if (vercelBypass) {
    extraHeaders["x-vercel-protection-bypass"] = vercelBypass;
    extraHeaders["x-vercel-set-bypass-cookie"] = "true";
  }
}

// Optionnel : désactiver storageState si tu veux éviter toute pollution
const disableStorageState = (process.env.E2E_DISABLE_STORAGE_STATE ?? "").trim() === "1";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: require.resolve("./e2e/global-setup"),
  outputDir: "test-results",

  fullyParallel: true,

  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,

  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL,

    locale: "fr-FR",
    timezoneId: "Europe/Paris",

    ...(disableStorageState ? {} : { storageState: ".pw/storageState.json" }),

    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",

    extraHTTPHeaders: extraHeaders,
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  ...(startWebServer
    ? {
        webServer: {
          command: `pnpm exec next dev -p ${devPort} --hostname 127.0.0.1`,
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
          env: { ...toStringEnv(process.env) },
          stdout: "pipe",
          stderr: "pipe",
        },
      }
    : {}),
});
