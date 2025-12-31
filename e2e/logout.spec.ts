// e2e/logout.spec.ts
import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  IS_REMOTE_BASE,
  waitForHealth,
  login,
  logout,
  expectRedirectToPaywall,
  firstRedirectResponse,
  setSessionCookieFromEnv,
} from "./helpers";

test.describe("Logout", () => {
  test.beforeAll(async () => {
    await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? "/api/health", 20_000);
  });

  test.beforeEach(async ({ context }) => {
    // si staging + cookie fourni => injecté ici
    await setSessionCookieFromEnv(context);
  });

  test("efface le cookie et réactive le paywall", async ({ page }) => {
    // Sur remote: nécessite un cookie (sinon login remote impossible)
    test.skip(
      IS_REMOTE_BASE && !process.env.E2E_SESSION_COOKIE?.trim(),
      "Remote logout needs E2E_SESSION_COOKIE",
    );

    // 1) Se loguer (local via /api/login, remote via cookie env)
    await login(page);

    // 2) Appeler l’API de logout
    const res = await logout(page);

    // ✅ tolérant: certains backends renvoient 200/204/302
    expect([200, 204, 302]).toContain(res.status());

    // 3) Vérifier que /pro est à nouveau protégé
    const nav = await page.goto("/pro", { waitUntil: "domcontentloaded" });

    // soit on a une redirection middleware (307/302...)
    const first = await firstRedirectResponse(nav);
    if (first && [301, 302, 303, 307, 308].includes(first.status())) {
      await expectRedirectToPaywall(first, "/pro");
      return;
    }

    // soit on atterrit directement sur /paywall
    const u = new URL(page.url(), BASE_URL);
    expect(u.pathname).toBe("/paywall");
  });
});
