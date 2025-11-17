// e2e/logout.spec.ts
import { test, expect } from '@playwright/test';
import { login, logout, expectRedirectToPaywall, firstRedirectResponse } from './helpers';

test.describe('Logout', () => {
  test('efface le cookie et réactive le paywall', async ({ page }) => {
    // 1) Se loguer pour obtenir le cookie "session"
    await login(page);

    // 2) Appeler l’API de logout
    const res = await logout(page);
    expect(res.status()).toBe(204);

    // 3) Vérifier que /pro est à nouveau protégé (307 => /paywall + header x-paywall: 1)
    const nav = await page.goto('/pro', { waitUntil: 'domcontentloaded' });
    const first = await firstRedirectResponse(nav);
    await expectRedirectToPaywall(first, '/pro');
  });
});
