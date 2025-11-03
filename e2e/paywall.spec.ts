// e2e/paywall.spec.ts
import { test, expect } from '@playwright/test';
import {
  BASE_URL,
  waitForHealth,
  login,
  isPaywallVisible,
  gotoOk,
  expectRedirectToPaywall,
  readStatus,
  setSessionCookieFromEnv,
  firstRedirectResponse,
} from './helpers';

test.describe('Paywall /pro', () => {
  test.beforeAll(async () => {
    await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? '/api/health', 20_000);
  });

  test.beforeEach(async ({ context }) => {
    // si un cookie de session est fourni via ENV, on l'injecte pour le test courant
    await setSessionCookieFromEnv(context);
  });

  test("anonymous → middleware redirects (307 + Location '/paywall?paywall=1&from=/pro')", async ({ page }) => {
    await page.context().clearCookies();

    const res = await page.goto('/pro', { waitUntil: 'domcontentloaded' });
    const first = await firstRedirectResponse(res);
    expect(first).not.toBeNull();

    await expectRedirectToPaywall(first!, '/pro');

    const u = new URL(page.url(), BASE_URL);
    expect(u.pathname).toBe('/paywall');

    // Query optionnels (le front peut les nettoyer après rendu)
    const pw = u.searchParams.get('paywall');
    if (pw !== null) expect(pw).toBe('1');
    const from = u.searchParams.get('from');
    if (from !== null) expect(from).toBe('/pro');

    // Heuristique visuelle facultative
    const visible = await isPaywallVisible(page);
    expect.soft(visible).toBeTruthy();
  });

  test('authorized via /api/login cookie → /pro is 200', async ({ page }) => {
    await login(page, { plan: 'premium' });
    const r = await gotoOk(page, '/pro', { waitUntil: 'domcontentloaded' });
    expect(readStatus(r)).toBe(200);
  });

  // ⛳️ Skip si PAS de token
  test.skip(!process.env.E2E_BEARER_TOKEN, 'E2E_BEARER_TOKEN manquant');

  test('authorized via Authorization: Bearer <token> → /pro is 200', async ({ page }) => {
    const r = await page.request.get('/pro', {
      headers: { authorization: `Bearer ${process.env.E2E_BEARER_TOKEN}` },
    });
    expect(readStatus(r)).toBe(200);
  });
});
