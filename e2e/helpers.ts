// e2e/helpers.ts
import {
  expect,
  request,
  type Page,
  type BrowserContext,
  type APIResponse,
  type Response as PWResponse, // Réponse réseau Playwright
} from '@playwright/test'

/* ───────────────────────────── Types & Constantes ─────────────────────────── */

type FetchResponse = globalThis.Response
export type ResLike = PWResponse | APIResponse | FetchResponse
export type MaybeResponse = ResLike | null

export const BASE_URL =
  (process.env.E2E_BASE_URL?.trim() || 'http://127.0.0.1:3000') as string
export const E2E_SMOKE_PATH =
  (process.env.E2E_SMOKE_PATH?.trim() || '/api/health') as string

/* ─────────────────────────────── Type guards ──────────────────────────────── */

function hasHeadersFn(r: unknown): r is { headers(): Record<string, string> } {
  return typeof (r as any)?.headers === 'function'
}
function hasStatusFn(r: unknown): r is { status(): number } {
  return typeof (r as any)?.status === 'function'
}
function isFetchResponse(r: unknown): r is FetchResponse {
  return !!(r as any)?.headers?.get && typeof (r as any).headers.get === 'function'
}
function hasHeadersRecord(r: unknown): r is { headers: Record<string, string> } {
  return !!(r as any)?.headers && typeof (r as any).headers === 'object' && !isFetchResponse(r)
}

/* ─────────────────────────────── Healthcheck ──────────────────────────────── */

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
      lastStatus = res.status()
      if (res.ok()) {
        await client.dispose()
        return
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  await client.dispose()
  throw new Error(
    `Healthcheck failed for ${baseUrl}${healthPath} (last status ${lastStatus})`,
  )
}

/* ────────────────────────────────── Auth ──────────────────────────────────── */

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

/** Pose un cookie depuis la variable d'env E2E_SESSION_COOKIE (format Set-Cookie). */
export async function setSessionCookieFromEnv(
  context: BrowserContext,
  baseUrl: string = BASE_URL,
): Promise<void> {
  const raw = process.env.E2E_SESSION_COOKIE?.trim() ?? ''
  if (!raw) return

  const parts = raw.split(';').map((s) => s.trim()).filter(Boolean)
  const nv = parts.shift() ?? ''
  const eq = nv.indexOf('=')
  if (eq < 0) throw new Error('E2E_SESSION_COOKIE must be "name=value; Attr=…"')

  const name = nv.slice(0, eq)
  const value = nv.slice(eq + 1)
  
  const attrs = new Map<string, string | true>()
  for (const p of parts) {
    const i = p.indexOf('=')
    if (i === -1) attrs.set(p.toLowerCase(), true)
    else attrs.set(p.slice(0, i).toLowerCase(), p.slice(i + 1))
  }

  const url = new URL(baseUrl)
  const domain = (attrs.get('domain') as string | undefined)?.replace(/^\./, '') ?? url.hostname
  const path = (attrs.get('path') as string | undefined) ?? '/'

  const samesiteAttr = ((attrs.get('samesite') as string | undefined) ?? 'Lax').toLowerCase()
  const sameSite: 'Strict' | 'Lax' | 'None' =
    samesiteAttr === 'strict' ? 'Strict' : samesiteAttr === 'none' ? 'None' : 'Lax'

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

/* ─────────────────────────── Headers: utilitaires ─────────────────────────── */

/** Lecture d’un header (insensible à la casse), toujours **synchrone**. */
// --- util headers (une seule version, synchrone) ---
export function headerValue(res: unknown, name: string): string | null {
  const lower = name.toLowerCase();

  // Playwright/APIResponse -> headers(): Record<string,string>
  if (typeof (res as any)?.headers === 'function') {
    const h = (res as any).headers() as Record<string, string>;
    return h[lower] ?? h[name] ?? h[name.toUpperCase()] ?? null;
  }
  // fetch Response -> Headers.get(name)
  if ((res as any)?.headers?.get) {
    return ((res as any).headers.get(name) as string) ?? null;
  }
  // Objet { headers: Record<string,string> }
  if ((res as any)?.headers && typeof (res as any).headers === 'object') {
    const rec = (res as any).headers as Record<string, string>;
    return rec[lower] ?? rec[name] ?? rec[name.toUpperCase()] ?? null;
  }
  return null;
}

export function getHeader(res: unknown, name: string): string | null {
  return headerValue(res, name)
}

/* ───────────────────────── Assertions & Navigation ────────────────────────── */

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

  const status = hasStatusFn(res) ? (res as any).status() : ((res as any).status ?? 0)
  expect(okSet.has(status)).toBeTruthy()
}

export async function gotoOk(
  page: Page,
  path: string,
  opts?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; allowRedirects?: boolean },
): Promise<PWResponse> {
  const res = await page.goto(path, { waitUntil: opts?.waitUntil ?? 'domcontentloaded' })
  if (!res) throw new Error('Navigation failed: no response')
  expectOk(res, { allowRedirects: opts?.allowRedirects }) // ✅ un seul expectOk
  return res
}

/* ───────────────────────────── Paywall helpers ────────────────────────────── */

export async function isPaywallVisible(
  page: Page,
  customSelector?: string,
  timeoutMs = 500,
): Promise<boolean> {
  const selectors = (
    [
      customSelector,
      "[data-test='paywall']",
      "[data-testid='paywall']",
      'section.paywall',
      '.paywall',
      '#paywall',
    ] as (string | undefined)[]
  ).filter(Boolean) as string[]

  for (const sel of selectors) {
    const loc = page.locator(sel).first()
    try {
      if ((await loc.count()) > 0 && (await loc.isVisible({ timeout: timeoutMs }))) return true
    } catch {
      /* ignore */
    }
  }

  const byText = page
    .locator('body')
    .getByText(/subscribe|upgrade|premium|paywall|sign in|log in|abonne(z|ment)|premium/i, {
      exact: false,
    })
    .first()

  try {
    if ((await byText.count()) && (await byText.isVisible({ timeout: timeoutMs }))) return true
  } catch {
    /* ignore */
  }
  return false
}

// ---- assertion paywall (tolérante 307/308 et /paywall OU même chemin + flag) ----
export function expectRedirectToPaywall(res: any, fromPath = '/pro'): void {
  // 307 ou 308 selon proxy/host
  const status = typeof res?.status === 'function' ? res.status() : (res?.status ?? 0);
  expect([307, 308].includes(status)).toBeTruthy();

  // Location obligatoire
  const loc = headerValue(res, 'location');
  expect(loc, 'expected Location header').toBeTruthy();

  if (!loc) return;

  // Analyse de la cible de redirection
  const u = new URL(loc, BASE_URL);

  // 1) Chemin explicitement paywall
  const isPaywallPath = u.pathname === '/paywall';

  // 2) Variante: on reste sur le fromPath mais avec un indicateur paywall
  const hasPaywallFlag =
    u.searchParams.get('paywall') === '1' ||
    u.searchParams.get('x') === 'paywall' ||
    u.searchParams.get('x-paywall') === '1';

  const isSamePathWithFlag = u.pathname === fromPath && hasPaywallFlag;

  expect(
    isPaywallPath || isSamePathWithFlag
  ).toBeTruthy();

  // Si 'from' est présent, il doit pointer sur fromPath (sinon on ne teste pas)
  const from = u.searchParams.get('from');
  if (from !== null) expect(from).toBe(fromPath);

  // Si on est bien sur /paywall, on accepte -optionnellement- ?paywall=1
  if (isPaywallPath) {
    const paywall = u.searchParams.get('paywall');
    if (paywall !== null) expect(paywall).toBe('1');
  }
}
