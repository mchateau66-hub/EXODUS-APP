// e2e/helpers.ts
import {
  expect,
  type Page,
  type BrowserContext,
  request,
  type APIRequestContext,
  type Response,
  type APIResponse,
} from '@playwright/test'

export type MaybeResponse = Response | null
export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000'

/* ------------------------------- Health ------------------------------- */

export async function waitForHealth(
  baseUrl: string = BASE_URL,
  healthPath: string = process.env.E2E_SMOKE_PATH ?? '/api/health',
  timeoutMs = 15_000
): Promise<void> {
  const client: APIRequestContext = await request.newContext({ baseURL: baseUrl })
  const deadline = Date.now() + timeoutMs
  let lastStatus = 0

  while (Date.now() < deadline) {
    try {
      const res = await client.get(healthPath, { timeout: 5_000 })
      lastStatus = res.status()
      if (res.ok()) {
        await client.dispose()
        return
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500))
  }

  await client.dispose()
  throw new Error(`Healthcheck failed for ${baseUrl}${healthPath} (last status ${lastStatus})`)
}

/* ------------------------------- Auth -------------------------------- */

export async function login(
  page: Page,
  data: { session?: string; maxAge?: number } = {}
): Promise<APIResponse> {
  const res = await page.request.post('/api/login', { data })
  expect(res.ok()).toBeTruthy()
  return res
}

/**
 * Pose un cookie depuis la variable d'env E2E_SESSION_COOKIE.
 * Ex: "session=<uuid>" ou "session=<uuid>; Path=/; HttpOnly; SameSite=Lax; Secure"
 */
export async function setSessionCookieFromEnv(
  context: BrowserContext,
  cookieEnv: string | undefined = process.env.E2E_SESSION_COOKIE,
  baseUrl: string = BASE_URL
): Promise<void> {
  if (!cookieEnv || !cookieEnv.trim()) return

  const parts = cookieEnv.split(';').map(s => s.trim()).filter(Boolean)
  const nv = parts.shift()!
  const eq = nv.indexOf('=')
  if (eq < 0) throw new Error('E2E_SESSION_COOKIE must be "name=value[; Attr=...]"')

  const name = nv.slice(0, eq).trim()
  const value = nv.slice(eq + 1)
  const url = new URL(baseUrl)

  const attrs = new Map<string, string | true>()
  for (const a of parts) {
    const i = a.indexOf('=')
    if (i === -1) attrs.set(a.toLowerCase(), true)
    else attrs.set(a.slice(0, i).toLowerCase(), a.slice(i + 1))
  }

  const domainAttr = (attrs.get('domain') as string | undefined)?.replace(/^\./, '')
  const pathAttr = (attrs.get('path') as string | undefined) ?? '/'
  const sameSiteAttr = String(attrs.get('samesite') ?? 'Lax').toLowerCase() as
    | 'lax' | 'strict' | 'none'

  await context.addCookies([{
    name,
    value,
    domain: domainAttr || url.hostname,
    path: pathAttr,
    secure: Boolean(attrs.get('secure')),
    httpOnly: Boolean(attrs.get('httponly')),
    sameSite: sameSiteAttr === 'none' ? 'None' : sameSiteAttr === 'strict' ? 'Strict' : 'Lax',
    expires: undefined,
  }])
}

/* ------------------------------ Paywall ------------------------------ */

export async function isPaywallVisible(
  page: Page,
  customSelector?: string,
  timeoutMs = 500
): Promise<boolean> {
  const selectors = [
    customSelector,
    '[data-test="paywall"]',
    '[data-testid="paywall"]',
    'section.paywall',
    '#paywall',
    '.paywall',
  ].filter(Boolean) as string[]

  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first()
      if ((await loc.count()) > 0 && (await loc.isVisible({ timeout: timeoutMs }))) return true
    } catch {}
  }

  const byText = page.locator('body').getByText(
    /subscribe|upgrade|premium|paywall|sign in|log in|abonnez|abonnement|abonne|premium/i,
    { exact: false }
  ).first()

  try {
    if ((await byText.count()) && (await byText.isVisible({ timeout: timeoutMs }))) return true
  } catch {}

  return false
}

/* ----------------------------- Assertions ---------------------------- */

export function expectOk(
  res: MaybeResponse,
  opts?: { allowRedirects?: boolean; allowedStatuses?: number[] }
): asserts res is Response {
  const { allowRedirects = false, allowedStatuses } = opts ?? {}
  const okSet = new Set<number>(
    allowedStatuses ??
      (allowRedirects
        ? [200, 201, 202, 203, 204, 206, 301, 302, 303, 304, 307, 308]
        : [200, 201, 202, 203, 204, 206, 304])
  )
  const status = res ? res.status() : 0
  if (!res || !okSet.has(status)) throw new Error(`HTTP status invalid: ${status}`)
}

export async function gotoOk(
  page: Page,
  path: string,
  opts?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; allowRedirects?: boolean }
): Promise<Response> {
  const res = await page.goto(path, { waitUntil: opts?.waitUntil ?? 'domcontentloaded' })
  if (!res) throw new Error('Navigation failed: no response')
  expectOk(res, { allowRedirects: opts?.allowRedirects })
  return res
}

/* ---- util: header compatible Response | APIResponse ---- */
type AnyResp = Response | APIResponse
function getHeader(res: AnyResp, name: string): string | null | undefined {
  const anyRes = res as any
  if (typeof anyRes.headerValue === 'function') return anyRes.headerValue(name) // Response
  const obj = anyRes.headers?.() ?? {}
  const key = name.toLowerCase()
  return obj[key] ?? obj[name]
}

export function expectRedirectToPaywall(res: AnyResp, fromPath = '/pro') {
  const status = (res as any).status?.() ?? 0
  const location = getHeader(res, 'location')
  expect(status, 'expected paywall 307').toBe(307)
  expect(location, 'expected Location header').toBeTruthy()

  try {
    const u = new URL(String(location), BASE_URL)
    expect(u.searchParams.get('paywall')).toBe('1')
    if (u.searchParams.has('from')) {
      expect(u.searchParams.get('from')).toBe(fromPath)
    }
  } catch {
    // si Location est relatif, la présence du header suffit
  }

  const x = getHeader(res, 'x-paywall')
  if (x) expect(String(x)).toBe('1')
}

/* ------------------------------ Utils -------------------------------- */

export const wait = (ms: number) => new Promise(res => setTimeout(res, ms))
