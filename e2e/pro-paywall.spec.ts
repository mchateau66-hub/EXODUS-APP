// e2e/pro-paywall.spec.ts
import { test, expect } from '@playwright/test';
import { BASE_URL, login, readStatus } from './helpers';

const FROM = '/pro';

test.describe('Paywall /pro (cas détaillés)', () => {
  test('Anon → redirect vers /paywall?from=/pro (ou 401/403/404 si flag)', async ({ page }) => {
    const res = await page.goto(FROM, { waitUntil: 'domcontentloaded' });

    // URL finale (fiable) pour lire pathname/searchParams
    const u = new URL(page.url(), BASE_URL);

    // Si ce n'est PAS /paywall, on tolère une API-block (401/403/404) quand le flag est ON
    if (u.pathname !== '/paywall') {
      const allow404 = process.env.E2E_PAYWALL_ALLOW_404_AS_BLOCK === '1';
      const status = readStatus(res);
      if (allow404) {
        expect([401, 403, 404]).toContain(status);
      } else {
        throw new Error(`Attendu /paywall?from=${FROM}, obtenu ${page.url()} (status ${status})`);
      }
      return; // cas « toléré » terminé
    }

    // Cas nominal : bien sur /paywall + bon query param from
    expect(u.searchParams.get('from') ?? '').toBe(FROM);
  });

  test('Paywall /pro | session cookie → 200 /pro', async ({ page }) => {
    // pose un cookie "session" (ex: plan premium)
    await login(page, { plan: 'premium' });

    const r = await page.goto(FROM, { waitUntil: 'domcontentloaded' });
    expect(r?.ok()).toBeTruthy();

    const u = new URL(page.url(), BASE_URL);
    expect(u.pathname).toBe('/pro');
  });

  // ⛳️ Skip si PAS de token en ENV (fix du sens)
  test.skip(!process.env.E2E_BEARER_TOKEN, 'E2E_BEARER_TOKEN manquant');

  test('Paywall /pro | Authorization: Bearer <token> → 200 /pro', async ({ browser }) => {
    const ctx = await browser.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { authorization: `Bearer ${process.env.E2E_BEARER_TOKEN}` },
    });
    const page = await ctx.newPage();

    const r = await page.goto(FROM, { waitUntil: 'domcontentloaded' });
    expect(r?.ok()).toBeTruthy();

    const u = new URL(page.url(), BASE_URL);
    expect(u.pathname).toBe('/pro');

    await ctx.close();
  });
});
