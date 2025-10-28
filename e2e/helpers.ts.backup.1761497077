// e2e/helpers.ts
import {
  request,
  expect,
  type Page,
  type BrowserContext,
  type APIResponse,
  type Response as PWResponse,
} from '@playwright/test'

/* ───────────────────────── Types & Constantes ───────────────────────── */

type FetchResponse = globalThis.Response
export type ResLike = PWResponse | APIResponse | FetchResponse
export type MaybeResponse = ResLike | null

export const BASE_URL = (process.env.E2E_BASE_URL?.trim() || 'http://127.0.0.1:3000') as string
export const E2E_SMOKE_PATH = (process.env.E2E_SMOKE_PATH?.trim() || '/api/health') as string

/* ───────────────────────── Type Guards ───────────────────────── */

function hasStatusFn(r: unknown): r is { status(): number } {
  return typeof (r as any)?.status === 'function'
}
function isFetchResponse(r: unknown): r is FetchResponse {
  // fetch Response: headers: Headers with .get()
  return typeof (r as any)?.headers?.get === 'function'
}
function hasHeadersFn(r: unknown): r is { headers(): Record<string, string> } {
  // Playwright Response / APIResponse: headers() -> Record<string,string>
  return typeof (r as any)?.headers === 'function'
}
function hasHeadersRecord(r: unknown): r is { headers: Record<string, string> } {
  return !!(r as any)?.headers && typeof (r as any).headers === 'object' && !isFetchResponse(r)
}

/* ───────────────────────── Headers: utilitaires ───────────────────────── */

/** Lecture d’un header (insensible à la casse), **synchrone**, pour PWResponse | APIResponse | fetch Response. */
export function headerValue(res: unknown, name: string): string | null {
  const lower = name.toLowerCase()

  if (hasHeadersFn(res)) {
    const rec = (res as any).headers() as Record<string, string>
    return rec[lower] ?? rec[name] ?? rec[name.toUpperCase()] ?? null
  }
  if (isFetchResponse(res)) {
    return (res as any).headers.get(name) ?? null
  }
  if (hasHeadersRecord(res)) {
    const rec = (res as any).headers as Record<string, string>
    return rec[lower] ?? rec[name] ?? rec[name.toUpperCase()] ?? null
  }
  return null
}

export function getHeader(res: unknown, name: string): string | null {
  return headerValue(res, name)
}

/* ───────────────────────── Assertions & Navigation ───────────────────────── */

export function expectOk(
  res: MaybeResponse,
  opts?: { allowRedirects?: boolean; allowedStatuses?: number[] },
): void {
  if (!res) throw new Error('HTTP response is null')

  const allowRedirects = opts?.allowRedirects ?? false
  const defaultStatuses = allowRedirects
    ? [200, 201, 202, 203, 204, 206, 301, 302, 303, 304, 307, 308]
    : [200, 201, 202, 203, 204, 206]

  const okSet = new Set<number>(opts?.allowedStatuses ?? defaultStatuses)

  const status = hasStatusFn(res) ? res.status() : ((res as any)?.status ?? 0)
  expect(okSet.has(status)).toBeTruthy()
}

export async function gotoOk(
  page: Page,
  path: string,
  opts?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; allowRedirects?: boolean },
): Promise<PWResponse> {
  const allow = opts?.allowRedirects ?? (process.env.E2E_ACCEPT_SAME_PATH_REDIRECT === '1')
  const res = await page.goto(path, { waitUntil: opts?.waitUntil ?? 'domcontentloaded' })
  if (!res) throw new Error('Navigation failed: no response')
  expectOk(res, { allowRedirects: allow })
  return res
}

/** Helper navigation : accepte un redirect **vers le même pathname** si E2E_ACCEPT_SAME_PATH_REDIRECT='1'. */
export async function ensureOn(page: Page, pathOrUrl: string) {
  const expected = new URL(pathOrUrl, BASE_URL)
  await page.goto(expected.toString())
  if (process.env.E2E_ACCEPT_SAME_PATH_REDIRECT === '1') {
    const final = new URL(page.url())
    expect(final.pathname).toBe(expected.pathname)
  } else {
    await expect(page).toHaveURL(expected.toString())
  }
}

/* ───────────────────────── Paywall helpers ───────────────────────── */

export async function isPaywallVisible(
  page: Page,
  customSelector?: string,
  timeoutMs = 500,
): Promise<boolean> {
  const selectors = [
    customSelector,
    "[data-test='paywall']",
    "[data-testid='paywall']",
    'section.paywall',
    '.paywall',
    '#paywall',
  ].filter(Boolean) as string[]

  for (const sel of selectors) {
    const loc = page.locator(sel).first()
    try {
      if ((await loc.count()) > 0 && (await loc.isVisible({ timeout: timeoutMs }))) return true
    } catch { /* ignore */ }
  }

  // texte brut (accents inclus)
  const byText = page
    .locator('body')
    .getByText(/subscribe|upgrade|premium|paywall|sign in|log in|abonn[eé](?:|z|ment)|premium/i, {
      exact: false,
    })
    .first()
  try {
    if ((await byText.count()) && (await byText.isVisible({ timeout: timeoutMs }))) return true
  } catch { /* ignore */ }

  // accessible (heading)
  const byRole = page.getByRole('heading', { name: /abonn[eé]|premium|paywall/i }).first()
  try {
    if ((await byRole.count()) && (await byRole.isVisible({ timeout: timeoutMs }))) return true
  } catch { /* ignore */ }

  return false
}

export function expectRedirectToPaywall(res: any, fromPath = '/pro'): void {
  const status = hasStatusFn(res) ? res.status() : (res?.status ?? 0)
  expect([301, 302, 303, 307, 308]).toContain(status)

  const loc = headerValue(res, 'location')
  expect(loc, 'expected Location header').toBeTruthy()

  if (loc) {
    const u = new URL(String(loc), BASE_URL) // supporte Location relatif
    expect(u.pathname).toBe('/paywall')

    const paywall = u.searchParams.get('paywall')
    if (paywall != null) expect(paywall).toBe('1')

    const from = u.searchParams.get('from')
    if (from != null) expect(new URL(from, u.origin).pathname).toBe(fromPath)
  }

  const x = headerValue(res, 'x-paywall')
  if (x) expect(String(x)).toBe('1')
}

/** Assertion générique : redirect vers un pathname donné (tolère 301/302/303/307/308). */
export function expectSamePathRedirect(res: any, toPath: string) {
  const status = hasStatusFn(res) ? res.status() : (res?.status ?? 0)
  expect([301, 302, 303, 307, 308]).toContain(status)
  const loc = headerValue(res, 'location')
  expect(loc).toBeTruthy()
  const target = new URL(String(loc), BASE_URL)
  expect(target.pathname).toBe(toPath)
}

/* ───────────────────────── Auth helpers ───────────────────────── */

export async function login(
  page: Page,
  data: { session?: string; maxAge?: number } = {},
): Promise<APIResponse> {
  const res = await page.request.post('/api/login', { data })
  expect(res.ok()).toBeTruthy()
  return res
}

export async function logout(page: Page): Promise<APIResponse> {
  const res = await page.request.post('/api/logout')
  expect(res.status()).toBe(204)
  return res
}

/** Pose un cookie depuis la variable d’env `E2E_SESSION_COOKIE` (format Set-Cookie). */
export async function setSessionCookieFromEnv(
  context: BrowserContext,
  baseUrl: string = BASE_URL,
): Promise<void> {
  const raw = process.env.E2E_SESSION_COOKIE?.trim() ?? ''
  if (!raw) return

  // name=value ; Attr=... ; HttpOnly ; Secure ; SameSite=...
  const parts = raw.split(';').map((s) => s.trim()).filter(Boolean)
  const nv = parts.shift() ?? ''
  const eq = nv.indexOf('=')
  if (eq < 0) throw new Error('E2E_SESSION_COOKIE must be "name=value; Attr=..."')

  const name = nv.slice(0, eq)
  const value = nv.slice(eq + 1)

  const attrs = new Map<string, string | true>()
  for (const p of parts) {
    const i = p.indexOf('=')
    if (i === -1) attrs.set(p.toLowerCase(), true)
    else attrs.set(p.slice(0, i).toLowerCase(), p.slice(i + 1))
  }

  const url = new URL(baseUrl)
  const domain =
    (attrs.get('domain') as string | undefined)?.replace(/^\./, '') ?? url.hostname
  const path = (attrs.get('path') as string | undefined) ?? '/'

  const samesiteAttr = (attrs.get('samesite') as string | undefined)?.toLowerCase() ?? 'lax'
  const sameSite = samesiteAttr === 'strict' ? 'Strict' : samesiteAttr === 'none' ? 'None' : 'Lax'

  await context.addCookies([
    {
      name,
      value,
      domain,
      path,
      httpOnly: attrs.has('httponly'),
      secure: attrs.has('secure'),
      sameSite,
    },
  ])
}

/* ───────────────────────── Healthcheck ───────────────────────── */

export async function waitForHealth(
  baseUrl: string = BASE_URL,
  healthPath: string = E2E_SMOKE_PATH,
  timeoutMs = 15_000,
): Promise<void> {
  const client = await request.newContext({ baseURL: baseUrl })
  const deadline = Date.now() + timeoutMs
  let lastStatus = 0

  while (Date.now() < deadline) {
    try {
      const res = await client.get(healthPath, { timeout: 5_000 })
      lastStatus = hasStatusFn(res) ? res.status() : ((res as any)?.status ?? 0)
      if (lastStatus >= 200 && lastStatus < 400) {
        await client.dispose()
        return
      }
    } catch {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, 500))
  }

  await client.dispose()
  throw new Error(`Healthcheck failed for ${baseUrl}${healthPath} (last status ${lastStatus})`)
}
