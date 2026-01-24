// e2e/pro-paywall.spec.ts
import { test, expect } from "@playwright/test";
import {
  BASE_URL,
  IS_REMOTE_BASE,
  waitForHealth,
  setSessionCookieFromEnv,
  login,
  readStatus,
  setPlanCookie,
} from "./helpers";

const FROM = "/pro";

test.describe("Paywall /pro (cas détaillés)", () => {
  test.beforeAll(async () => {
    await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? "/api/health", 20_000);
  });

  test.beforeEach(async ({ context }) => {
    await setSessionCookieFromEnv(context);
  });

  test("Anon → redirect vers /paywall?from=/pro (ou 401/403/404 si flag)", async ({ page }) => {
    await page.context().clearCookies();

    const res = await page.goto(FROM, { waitUntil: "domcontentloaded" });
    const u = new URL(page.url(), BASE_URL);

    if (u.pathname !== "/paywall") {
      const allow404 = process.env.E2E_PAYWALL_ALLOW_404_AS_BLOCK === "1";
      const status = readStatus(res);
      if (allow404) {
        expect([401, 403, 404]).toContain(status);
      } else {
        throw new Error(`Attendu /paywall?from=${FROM}, obtenu ${page.url()} (status ${status})`);
      }
      return;
    }

    expect(u.searchParams.get("from") ?? "").toBe(FROM);
  });

  test("Paywall /pro | session cookie → 200 /pro", async ({ page, context }) => {
    test.skip(
      IS_REMOTE_BASE && !process.env.E2E_SESSION_COOKIE?.trim(),
      "Remote /pro needs E2E_SESSION_COOKIE",
    );

    await setPlanCookie(context, "premium");
    await login(page, { plan: "premium" });

    const r = await page.goto(FROM, { waitUntil: "domcontentloaded" });
    expect(r).not.toBeNull();

    const u = new URL(page.url(), BASE_URL);
    if (u.pathname !== "/pro") {
      throw new Error(
        `Expected /pro with session cookie, got ${u.pathname}${u.search} (base=${BASE_URL}). ` +
          `Likely: cookie is not PRO or expired.`,
      );
    }

    expect(r?.ok()).toBeTruthy();
  });

  test("Paywall /pro | Authorization: Bearer <token> → 200 /pro", async ({ browser }) => {
    test.skip(!process.env.E2E_BEARER_TOKEN, "E2E_BEARER_TOKEN manquant");

    const ctx = await browser.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { authorization: `Bearer ${process.env.E2E_BEARER_TOKEN}` },
    });

    const page = await ctx.newPage();
    const r = await page.goto(FROM, { waitUntil: "domcontentloaded" });
    expect(r?.ok()).toBeTruthy();

    const u = new URL(page.url(), BASE_URL);
    expect(u.pathname).toBe("/pro");

    await ctx.close();
  });
});
