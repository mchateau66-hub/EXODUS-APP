// e2e/pro-paywall.spec.ts
import { test, expect } from '@playwright/test'

const FROM = '/pro'

/** Parse un header Set-Cookie complet et ajoute le cookie au contexte Playwright. */
async function addCookieFromSetCookie(page: import('@playwright/test').Page, setCookie: string, baseUrl: string) {
  const [cookieKV, ...attrs] = setCookie.split(';').map(s => s.trim())
  const eq = cookieKV.indexOf('=')
  const name = cookieKV.slice(0, eq)
  const value = cookieKV.slice(eq + 1)

  const domain = new URL(baseUrl || 'http://127.0.0.1:3000').hostname
  const pathAttr = attrs.find(a => /^path=/i.test(a))
  const path = pathAttr ? pathAttr.split('=')[1] : '/'

  const secure = attrs.some(a => /^secure$/i.test(a))
  const httpOnly = attrs.some(a => /^httponly$/i.test(a))
  const sameSiteAttr = attrs.find(a => /^samesite=/i.test(a))
  let sameSite: 'Lax' | 'Strict' | 'None' = 'Lax'
  if (sameSiteAttr) {
    const v = sameSiteAttr.split('=')[1]?.toLowerCase()
    if (v === 'strict') sameSite = 'Strict'
    else if (v === 'none') sameSite = 'None'
    else sameSite = 'Lax'
  }

  await page.context().addCookies([{ name, value, domain, path, secure, httpOnly, sameSite }])
}

/** Login helper: cookie depuis env, sinon POST /api/login. */
async function loginAs(page: import('@playwright/test').Page, plan: string = 'premium') {
  const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
  const envCookie = process.env.E2E_SESSION_COOKIE
  if (envCookie) {
    await addCookieFromSetCookie(page, envCookie, base)
    return
  }

  // Fallback: tente un login API pour setter le cookie côté contexte
  const res = await page.request.post('/api/login', { data: { plan } })
  if (res.ok()) {
    const setCookie = res.headers()['set-cookie'] || res.headers()['Set-Cookie']
    if (setCookie) {
      await addCookieFromSetCookie(page, Array.isArray(setCookie) ? setCookie[0] : setCookie, base)
    }
  }
}

test.describe('Paywall /pro', () => {
  test('Anon → redirect vers /paywall?from=/pro (ou 401/403/404 si flag)', async ({ page }) => {
    const resp = await page.goto(FROM, { waitUntil: 'domcontentloaded' })

    // cas OK: redirigé vers /paywall?from=/pro
    const url = new URL(page.url())
    if (url.pathname === '/paywall') {
      expect(url.searchParams.get('from') ?? '').toBe(FROM)
      return
    }

    // sinon, on tolère un blocage par status si flag actif
    const allow404 = process.env.E2E_PAYWALL_ALLOW_404_AS_BLOCK === '1'
    const status = resp?.status() ?? 0

    if (allow404) {
      expect([401, 403, 404]).toContain(status)
    } else {
      throw new Error(`Attendu /paywall?from=${FROM}, obtenu ${page.url()} (status ${status || 'unknown'})`)
    }
  })

  test('Session cookie → 200 /pro', async ({ page }) => {
    await loginAs(page, 'premium')
    const resp = await page.goto(FROM, { waitUntil: 'domcontentloaded' })
    expect(resp?.ok()).toBeTruthy()
    const u = new URL(page.url())
    expect(u.pathname).toBe('/pro')
  })

  test('Bearer → 200 /pro (skip si token absent)', async ({ browser }) => {
    test.skip(!process.env.E2E_BEARER_TOKEN, 'E2E_BEARER_TOKEN manquant')

    const ctx = await browser.newContext({
      baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3000',
      extraHTTPHeaders: { authorization: `Bearer ${process.env.E2E_BEARER_TOKEN}` },
    })
    const page = await ctx.newPage()
    const resp = await page.goto(FROM)
    expect(resp?.ok()).toBeTruthy()
    const u = new URL(page.url())
    expect(u.pathname).toBe('/pro')
    await ctx.close()
  })
})
