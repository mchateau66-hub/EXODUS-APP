// e2e/paywall.spec.ts
import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  E2E_SMOKE_PATH,
  IS_REMOTE_BASE,
  waitForHealth,
  login,
  isPaywallVisible,
  gotoOk,
  expectRedirectToPaywall,
  readStatus,
  setSessionCookieFromEnv,
  firstRedirectResponse,
  setPlanCookie,
  ensureAnon,
} from "./helpers";

test.describe("Paywall /pro", () => {
  test.beforeAll(async () => {
    await waitForHealth(BASE_URL, E2E_SMOKE_PATH, 20_000);
  });

  test("anonymous → middleware redirects (ou paywall rendu sur /pro)", async ({ page }) => {
    // ✅ crucial si tu utilises storageState : cookies + localStorage peuvent “ré-auth”
    await ensureAnon(page);

    const res = await page.goto("/pro", { waitUntil: "domcontentloaded" });

    // 1) Si un redirect a eu lieu, on vérifie le 1er hop
    const first = await firstRedirectResponse(res);
    if (first && [301, 302, 303, 307, 308].includes(first.status())) {
      expectRedirectToPaywall(first, "/pro");
    }

    // 2) Résultat final : on accepte 2 patterns
    const u = new URL(page.url(), BASE_URL);

    if (u.pathname === "/paywall") {
      // cas nominal
      const from = u.searchParams.get("from");
      if (from !== null) expect(from).toBe("/pro");
      expect.soft(await isPaywallVisible(page)).toBeTruthy();
    } else if (u.pathname === "/pro") {
      // cas “paywall inline” (pas de redirect)
      const visible = await isPaywallVisible(page);
      expect(visible).toBeTruthy();
    } else {
      throw new Error(`Expected /paywall or /pro, got ${u.pathname}${u.search} (base=${BASE_URL})`);
    }

    if (res) {
      expect([200, 301, 302, 303, 307, 308, 401, 403, 404]).toContain(readStatus(res));
    }
  });

  test("authorized session → /pro is 200", async ({ page, context }) => {
    test.skip(
      IS_REMOTE_BASE && !process.env.E2E_SESSION_COOKIE?.trim(),
      "Remote /pro requires E2E_SESSION_COOKIE with pro access",
    );

    // ✅ cookie plan (UI)
    await setPlanCookie(context, "premium");

    // ✅ Remote: inject cookie env (si présent). Local: login backdoor.
    await setSessionCookieFromEnv(context);
    await login(page, { plan: "premium" });

    const r = await gotoOk(page, "/pro", { waitUntil: "domcontentloaded", allowRedirects: true });

    const u = new URL(page.url(), BASE_URL);
    if (u.pathname !== "/pro") {
      throw new Error(
        `Expected /pro with authorized session, got ${u.pathname}${u.search} (base=${BASE_URL}). ` +
          `Likely: session cookie missing/not PRO, or middleware redirected.`,
      );
    }

    expect(readStatus(r)).toBe(200);

    // Bonus : si paywall visible alors que /pro est 200 → session pas vraiment PRO
    expect.soft(await isPaywallVisible(page)).toBeFalsy();
  });

  test("authorized via Authorization: Bearer <token> → /pro is 200", async ({ page }) => {
    test.skip(!process.env.E2E_BEARER_TOKEN, "E2E_BEARER_TOKEN manquant");

    const r = await page.request.get("/pro", {
      headers: { authorization: `Bearer ${process.env.E2E_BEARER_TOKEN}` },
    });
    expect(readStatus(r)).toBe(200);
  });
});
