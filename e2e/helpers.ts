// e2e/helpers.ts
import type { Page } from '@playwright/test'

function parseSetCookie(setCookie: string, baseUrl: string) {
  const [cookieKV, ...attrs] = setCookie.split(';').map(s => s.trim())
  const i = cookieKV.indexOf('=')
  const name = cookieKV.slice(0, i)
  const value = cookieKV.slice(i + 1)
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
  }
  return { name, value, domain, path, secure, httpOnly, sameSite }
}

export async function loginAs(page: Page, plan: string = 'premium') {
  const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'

  // 1) Cookie via secret/vars
  const envCookie = process.env.E2E_SESSION_COOKIE
  if (envCookie) {
    await page.context().addCookies([parseSetCookie(envCookie, base)])
    return
  }

  // 2) Fallback API login (si exposé)
  const res = await page.request.post('/api/login', { data: { plan } })
  if (res.ok()) {
    const setCookie =
      (res.headers() as any)['set-cookie'] || (res.headers() as any)['Set-Cookie']
    if (setCookie) {
      const header = Array.isArray(setCookie) ? setCookie[0] : setCookie
      await page.context().addCookies([parseSetCookie(header, base)])
    }
  }
}

export async function clearSession(page: Page) {
  await page.context().clearCookies()
}
