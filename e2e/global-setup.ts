// e2e/global-setup.ts
import fs from "node:fs/promises";
import path from "node:path";
import { chromium, request, type FullConfig } from "@playwright/test";
import {
  BASE_URL,
  E2E_SMOKE_PATH,
  waitForHealth,
  setSessionCookieFromEnv,
  login,
  envBool,
} from "./helpers";

const STORAGE_PATH = path.join(process.cwd(), ".pw", "storageState.json");

function extraHeadersForContext() {
  const h: Record<string, string> = { "x-e2e": "1" };

  const e2eToken = (process.env.E2E_DEV_LOGIN_TOKEN ?? "").trim();
  if (e2eToken) h["x-e2e-token"] = e2eToken;

  const bypass = (process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "").trim();
  if (bypass) {
    h["x-vercel-protection-bypass"] = bypass;
    // ✅ Important: demande à Vercel de poser le cookie de bypass
    h["x-vercel-set-bypass-cookie"] = "true";
  }

  return h;
}

export default async function globalSetup(_config: FullConfig) {
  await fs.mkdir(path.dirname(STORAGE_PATH), { recursive: true }).catch(() => {});

  const ignoreHTTPSErrors = envBool("E2E_IGNORE_HTTPS_ERRORS", false);
  const headers = extraHeadersForContext();

  // 0) Détecte "Authentication Required" si Preview protégée et bypass manquant
  try {
    const probe = await request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors,
      extraHTTPHeaders: headers,
    });

    const r = await probe.get("/", { timeout: 12_000 });
    if (r.status() === 401) {
      const txt = await r.text().catch(() => "");
      if (/Authentication Required/i.test(txt)) {
        throw new Error(
          `[e2e] Vercel Deployment Protection bloque la Preview (401 Authentication Required).\n` +
            `➡️ Ajoute VERCEL_AUTOMATION_BYPASS_SECRET (GitHub + local) et envoie le header x-vercel-protection-bypass\n` +
            `   (et idéalement x-vercel-set-bypass-cookie: true).\n` +
            `➡️ Ou rends les Preview publiques dans Vercel (Deployment Protection).\n` +
            `base=${BASE_URL}`,
        );
      }
    }

    await probe.dispose();
  } catch {
    // si DNS/TLS foire, waitForHealth fera un message plus clair ensuite
  }

  // 1) Healthcheck robuste + fixe process.env.E2E_SMOKE_PATH
  await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? E2E_SMOKE_PATH, 25_000);

  // 2) Génère storageState (cookies + session)
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors,
    extraHTTPHeaders: headers,
  });
  const page = await context.newPage();

  // ✅ Déclenche une navigation pour que Vercel puisse poser le bypass cookie (si configuré)
  // (on tolère l’échec : le healthcheck + login donneront des erreurs plus parlantes)
  try {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 20_000 });
  } catch {}

  // a) Si cookie fourni (ancien mode staging)
  if ((process.env.E2E_SESSION_COOKIE ?? "").trim()) {
    await setSessionCookieFromEnv(context, BASE_URL);
  } else {
    // b) Sinon, si token backdoor dispo (Preview / staging)
    if ((process.env.E2E_DEV_LOGIN_TOKEN ?? "").trim()) {
      await login(page, { plan: "free" });
    }
  }

  await context.storageState({ path: STORAGE_PATH });
  await context.close();
  await browser.close();

  if (process.env.CI) {
    console.log("[e2e] global-setup done", {
      BASE_URL,
      E2E_SMOKE_PATH: process.env.E2E_SMOKE_PATH,
      storageState: STORAGE_PATH,
      hasSessionCookie: Boolean((process.env.E2E_SESSION_COOKIE ?? "").trim()),
      hasE2EToken: Boolean((process.env.E2E_DEV_LOGIN_TOKEN ?? "").trim()),
      hasVercelBypass: Boolean((process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "").trim()),
      ignoreHTTPSErrors,
    });
  }
}
