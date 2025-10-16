// e2e/helpers.ts
import { expect, type Page, type BrowserContext, request, type APIRequestContext, type Response } from '@playwright/test';

export type MaybeResponse = Response | null;
export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

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
  ].filter(Boolean) as string[];

  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if (await loc.count()) {
      try {
        if (await loc.isVisible({ timeout: timeoutMs })) return true;
      } catch {}
    }
  }

  const byText = page
    .locator('body')
    .getByText(/(subscribe|upgrade|premium|paywall|sign in|log in|abonnez|abonnement|abonne|premium)/i, { exact: false })
    .first();

  try {
    if ((await byText.count()) && (await byText.isVisible({ timeout: timeoutMs }))) return true;
  } catch {}

  return false;
}

export function expectOk(
  res: MaybeResponse,
  opts?: { allowRedirects?: boolean; allowedStatuses?: number[] }
): asserts res is Response {
  const { allowRedirects = false, allowedStatuses } = opts ?? {};
  const okSet = new Set<number>(
    allowedStatuses ??
      (allowRedirects
        ? [200, 201, 202, 203, 204, 206, 301, 302, 303, 304, 307, 308]
        : [200, 201, 202, 203, 204, 206, 304])
  );
  const status = res?.status?.();
  expect(Boolean(res && status && okSet.has(status)), `HTTP status invalid: ${status}`).toBe(true);
}

export async function gotoOk(
  page: Page,
  path: string,
  opts?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; allowRedirects?: boolean }
): Promise<Response> {
  const res = await page.goto(path, { waitUntil: opts?.waitUntil ?? 'domcontentloaded' });
  expectOk(res, { allowRedirects: opts?.allowRedirects });
  return res!;
}

export async function setSessionCookieFromEnv(
  context: BrowserContext,
  cookieString = process.env.E2E_SESSION_COOKIE,
  baseUrl = BASE_URL
) {
  if (!cookieString) return;

  const url = new URL(baseUrl);
  const parts = cookieString.split(';').map((s) => s.trim()).filter(Boolean);
  const [nv, ...attrs] = parts;
  const [name, ...vparts] = nv.split('=');
  const value = vparts.join('=');

  const attrMap = new Map<string, string | true>();
  for (const a of attrs) {
    const [k, ...vv] = a.split('=');
    const key = k.trim().toLowerCase();
    const val = vv.length ? vv.join('=').trim() : true;
    attrMap.set(key, val);
  }

  const domainAttr = (attrMap.get('domain') as string | undefined)?.replace(/^\./, '');
  const pathAttr = (attrMap.get('path') as string | undefined) ?? '/';
  const sameSiteAttr = String(attrMap.get('samesite') ?? 'Lax').toLowerCase();

  await context.addCookies([
    {
      name: name!,
      value,
      domain: domainAttr || url.hostname,
      path: pathAttr,
      secure: Boolean(attrMap.get('secure')),
      httpOnly: Boolean(attrMap.get('httponly')),
      sameSite:
        sameSiteAttr === 'none' ? 'None' : sameSiteAttr === 'strict' ? 'Strict' : 'Lax',
      expires: undefined,
    },
  ]);
}

export async function waitForHealth(
  baseUrl = BASE_URL,
  healthPath = process.env.E2E_SMOKE_PATH ?? '/api/health',
  timeoutMs = 15_000
) {
  const client: APIRequestContext = await request.newContext();
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    try {
      const res = await client.get(new URL(healthPath, baseUrl).toString(), { timeout: 5000 });
      lastStatus = res.status();
      if (res.ok()) {
        await client.dispose();
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  await client.dispose();
  throw new Error(`Healthcheck failed for ${baseUrl}${healthPath} (last status ${lastStatus})`);
}
