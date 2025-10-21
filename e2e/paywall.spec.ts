// e2e/paywall.spec.ts
import {
  test,
  expect,
  type Response as PWResponse,
  type Request as PWRequest,
} from '@playwright/test'
import {
  BASE_URL,
  waitForHealth,
  login,
  setSessionCookieFromEnv,
  isPaywallVisible,
  gotoOk,
  expectRedirectToPaywall,
} from './helpers'

/** Remonte à la première Response rencontrée dans la chaîne de redirections d’un goto(). */
async function firstRedirectResponse(res: PWResponse | null): Promise<PWResponse | null> {
  if (!res) return null
  let last: PWResponse | null = res
  let prev: PWRequest | null = res.request().redirectedFrom()
  while (prev) {
    const maybe = await prev.response()
    if (!maybe) break
    last = maybe
    prev = prev.redirectedFrom()
  }
  return last
}

test.describe('Paywall /pro', () => {
  test.beforeAll(async () => {
    await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? '/api/health', 20_000)
  })

  test.beforeEach(async ({ context }) => {
    // Si un cookie a été injecté via var d’env, on l’ajoute (pratique pour reruns en CI)
    await setSessionCookieFromEnv(context)
  })

  test('anonymous → middleware redirects (307 + Location /paywall?paywall=1&from=/pro)', async ({ page }) => {
    await page.context().clearCookies()

    // 1) On navigue et on remonte à la 1ère réponse de redirection
    const nav = await page.goto('/pro', { waitUntil: 'domcontentloaded' })
    const first = await firstRedirectResponse(nav ?? null)
    expect(first).not.toBeNull()
    expectRedirectToPaywall(first!, '/pro') // ⬅️ strict: 307 + header Location exact

    // 2) URL finale (goto() a suivi la redirection)
    const u = new URL(page.url(), BASE_URL)
    expect(u.pathname).toBe('/paywall') // ⬅️ on exige le pathname

    // Query params optionnels (le front peut les nettoyer après rendu)
    const pw = u.searchParams.get('paywall')
    if (pw !== null) expect(pw).toBe('1')
    const from = u.searchParams.get('from')
    if (from !== null) expect(from).toBe('/pro')

    // 3) Heuristique visuelle (facultatif, n’échoue pas le test si absente)
    const visible = await isPaywallVisible(page)
    expect.soft(visible).toBeTruthy()
  })

  test('authorized via /api/login cookie → /pro is 200', async ({ page }) => {
    await login(page) // pose le cookie "session"
    const res = await gotoOk(page, '/pro', { waitUntil: 'domcontentloaded' })
    expect(res.status()).toBe(200)
  })

  test('authorized via Authorization: Bearer <token> → /pro is 200', async ({ page }) => {
    const r = await page.request.get('/pro', {
      headers: { authorization: 'Bearer test' },
    })
    expect(r.status()).toBe(200)
  })
})
