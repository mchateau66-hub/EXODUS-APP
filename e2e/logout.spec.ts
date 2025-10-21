// e2e/logout.spec.ts
import { test, expect } from '@playwright/test'
import { login, expectRedirectToPaywall } from './helpers'

test.describe('Logout', () => {
  test('efface le cookie et réactive le paywall', async ({ page }) => {
    // 1) Se loguer pour obtenir le cookie `session`
    await login(page)

    // 2) Appeler l’API de logout
    const res = await page.request.post('/api/logout')
    expect(res.status()).toBe(204)

    // 3) Vérifier que /pro est à nouveau protégé (307 -> /paywall + header x-paywall: 1)
    const r2 = await page.request.get('/pro', { maxRedirects: 0 })
    await expectRedirectToPaywall(r2, '/pro')
  })
})
