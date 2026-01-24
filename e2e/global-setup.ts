// e2e/global-setup.ts
import fs from "node:fs/promises";
import path from "node:path";
import { chromium, request, type FullConfig } from "@playwright/test";
import {
  BASE_URL,
  E2E_SMOKE_PATH,
  IS_LOCAL_BASE,
  waitForHealth,
  setSessionCookieFromEnv,
  login,
  envBool,
  e2eBaseHeaders,
} from "./helpers";

const STORAGE_PATH = path.join(process.cwd(), ".pw", "storageState.json");

export default async function globalSetup(_config: FullConfig) {
  const ignoreHTTPSErrors = envBool("E2E_IGNORE_HTTPS_ERRORS", false);

  // ✅ Flags robustes (1/true/yes)
  const skipLogin = envBool("E2E_SKIP_LOGIN", false);
  const disableStorageState = envBool("E2E_DISABLE_STORAGE_STATE", false);

  const hasSessionCookie = Boolean((process.env.E2E_SESSION_COOKIE ?? "").trim());
  const hasE2EToken = Boolean((process.env.E2E_DEV_LOGIN_TOKEN ?? "").trim());
  const hasVercelBypass = Boolean((process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "").trim());

  // Headers alignés avec helpers.ts (origin/referer + remote x-e2e/bypass/token)
  const headers = e2eBaseHeaders(BASE_URL);

  // 0) Détecte "Authentication Required" si Preview protégée et bypass manquant (remote only)
  if (!IS_LOCAL_BASE) {
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
              `➡️ Ajoute VERCEL_AUTOMATION_BYPASS_SECRET (GitHub Secrets + local) et envoie le header x-vercel-protection-bypass\n` +
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
  }

  // 1) Healthcheck robuste
  await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? E2E_SMOKE_PATH, 25_000);

  // ✅ SMOKE: si pas de storageState => on s’arrête là (donc zéro login)
  if (disableStorageState) {
    if (process.env.CI) {
      console.log("[e2e] global-setup done (storageState disabled)", {
        BASE_URL,
        E2E_SMOKE_PATH: process.env.E2E_SMOKE_PATH,
        skipLogin,
        disableStorageState,
        hasSessionCookie,
        hasE2EToken,
        hasVercelBypass,
        ignoreHTTPSErrors,
      });
    }
    return;
  }

  // 2) storageState actif: on prépare le dossier
  await fs.mkdir(path.dirname(STORAGE_PATH), { recursive: true }).catch(() => {});

  // 3) Génère storageState (cookies + éventuellement session)
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors,
    extraHTTPHeaders: headers,
  });
  const page = await context.newPage();

  // ✅ Déclenche une navigation (utile pour Vercel bypass cookie, si configuré)
  try {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 20_000 });
  } catch {}

  // a) Si cookie fourni (mode cookie) => on l’injecte et on écrit l’état
  if (hasSessionCookie) {
    await setSessionCookieFromEnv(context, BASE_URL);
  } else if (skipLogin) {
    // b) si on demande explicitement "pas de login" alors qu’on veut un storageState, c’est une incohérence
    throw new Error(
      `[e2e] global-setup: E2E_SKIP_LOGIN=1 mais storageState activé.\n` +
        `➡️ Soit tu mets E2E_DISABLE_STORAGE_STATE=1 (smoke),\n` +
        `➡️ Soit tu fournis E2E_SESSION_COOKIE (mode cookie),\n` +
        `➡️ Soit tu enlèves E2E_SKIP_LOGIN pour générer le storageState via login().`,
    );
  } else {
    // c) Login normal uniquement si configuré
    if (IS_LOCAL_BASE || hasE2EToken) {
      await login(page, { plan: "free" });
    } else {
      throw new Error(
        `[e2e] global-setup: storageState activé mais aucune auth configurée (remote).\n` +
          `➡️ Fournis E2E_SESSION_COOKIE ou E2E_DEV_LOGIN_TOKEN (+ endpoint e2e/dev autorisé).`,
      );
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
      skipLogin,
      disableStorageState,
      hasSessionCookie,
      hasE2EToken,
      hasVercelBypass,
      ignoreHTTPSErrors,
    });
  }
}
