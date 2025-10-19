// e2e/paywall.spec.ts
import { test, expect, type Response, type Request } from '@playwright/test'
import {
  BASE_URL,
  waitForHealth,
  login,
  setSessionCookieFromEnv,
  isPaywallVisible,
  gotoOk,
  expectRedirectToPaywall,
} from './helpers'

/** Remonte à la première Response de la chaîne de redirections (navigation). */
async function firstRedirectResponse(res: Response | null): Promise<Response | null> {
  if (!res) return null
  let req: Request = res.request()
  let prev: Request | null
  while ((prev = req.redirectedFrom())) req = prev
  // si aucune redirection -> la 1ère est la réponse elle-même
  const first = await req.response()
  return first ?? res
}

test.describe('Paywall /pro', () => {
  test.beforeAll(async () => {
    await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? '/api/health', 20_000)
  })

  test.beforeEach(async ({ context }) => {
    // Si un cookie a été injecté via var d’env, on l’ajoute
    await setSessionCookieFromEnv(context)
  })

  test('smoke: /api/health is 200', async ({ page }) => {
    const r = await page.request.get(process.env.E2E_SMOKE_PATH ?? '/api/health')
    expect(r.ok()).toBeTruthy()
  })

  test('anonymous → middleware redirects (307 + Location /?paywall=1&from=/pro)', async ({ page }) => {
    await page.context().clearCookies()

    // Navigation (permet de remonter la chaîne de redirections)
    const nav = await page.goto('/pro', { waitUntil: 'domcontentloaded' })
    const first = await firstRedirectResponse(nav ?? null)
    expect(first).not.toBeNull()
    if (first) expectRedirectToPaywall(first, '/pro')

    // URL finale = home + query paywall=1
    const u = new URL(page.url())
    expect(u.pathname).toBe('/')
    expect(u.searchParams.get('paywall')).toBe('1')
    expect(u.searchParams.get('from')).toBe('/pro')

    // Heuristique visuelle (facultatif)
    expect(await isPaywallVisible(page)).toBeTruthy()
  })

  test('authorized via /api/login cookie → /pro is 200', async ({ page }) => {
    await login(page) // pose le cookie "session"
    const res = await gotoOk(page, '/pro', { waitUntil: 'domcontentloaded' })
    expect(res.status()).toBe(200)
    await expect(page.getByRole('heading', { name: /Espace Pro/i })).toBeVisible()
  })

  test('authorized via Authorization: Bearer <token> → /pro is 200', async ({ page }) => {
    const r = await page.request.get('/pro', { headers: { authorization: 'Bearer test-token' } })
    expect(r.status()).toBe(200)
  })
})
