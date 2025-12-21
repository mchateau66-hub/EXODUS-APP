// e2e/helpers.ts
import {
  expect,
  request,
  type Page,
  type APIResponse,
  type BrowserContext,
} from "@playwright/test";

/**
 * Exports:
 *  BASE_URL, E2E_SMOKE_PATH,
 *  readStatus, headerValue, getHeader,
 *  expectOk, gotoOk, waitForHealth,
 *  login, logout, setSessionCookieFromEnv,
 *  isPaywallVisible, expectRedirectToPaywall, firstRedirectResponse
 */

// ---- Types utilitaires (Playwright + Fetch) ----
type PWResponse = import("@playwright/test").Response; // network Response (page.goto, etc.)
type FetchResponse = globalThis.Response;
export type ResLike = APIResponse | PWResponse | FetchResponse;

// ---- Constantes env ----
export const BASE_URL = (process.env.E2E_BASE_URL?.trim() ?? "http://127.0.0.1:3000") as string;
export const E2E_SMOKE_PATH = (process.env.E2E_SMOKE_PATH?.trim() ?? "/api/health") as string;

// ---- Détecteurs de status ----
function hasStatusFn(r: unknown): r is { status(): number } {
  return typeof (r as any)?.status === "function";
}
function hasStatusNumber(r: unknown): r is { status: number } {
  return typeof (r as any)?.status === "number";
}

/** Lecture normalisée du status, quel que soit le type de réponse */
export function readStatus(r: ResLike | null | undefined): number {
  if (!r) return 0;
  if (hasStatusFn(r)) return r.status();
  if (hasStatusNumber(r)) return (r as any).status;
  return 0;
}

// ---- Headers utilitaires ----
function headersOf(res: unknown): Record<string, string> | null {
  const any = res as any;

  // Fetch Response: res.headers: Headers
  if (any?.headers && typeof any.headers.get === "function") {
    const out: Record<string, string> = {};
    for (const [k, v] of any.headers.entries()) out[k.toLowerCase()] = v;
    return out;
  }

  // Playwright Response/APIResponse: res.headers(): Record<string,string>
  if (typeof any?.headers === "function") {
    const rec = (any.headers() as Record<string, string>) ?? {};
    const out: Record<string, string> = {};
    for (const k of Object.keys(rec)) out[k.toLowerCase()] = rec[k] ?? "";
    return out;
  }

  // Objet déjà normalisé
  if (typeof any?.headers === "object" && any?.headers) {
    const rec = any.headers as Record<string, string>;
    const out: Record<string, string> = {};
    for (const k of Object.keys(rec)) out[k.toLowerCase()] = rec[k] ?? "";
    return out;
  }

  return null;
}

export function headerValue(res: unknown, name: string): string | null {
  const rec = headersOf(res);
  if (!rec) return null;
  const lower = name.toLowerCase();
  return rec[lower] ?? null;
}

export const getHeader = (res: unknown, name: string) => headerValue(res, name);

// ---- Assertions HTTP & helpers de nav ----
export function expectOk(
  res: ResLike | null | undefined,
  opts?: { allowRedirects?: boolean; allowedStatuses?: number[] },
): void {
  if (!res) throw new Error("HTTP response is null");

  const allowRedirects = opts?.allowRedirects ?? false;

  const defaultStatuses = allowRedirects
    ? [200, 201, 202, 203, 204, 206, 301, 302, 303, 307, 308]
    : [200, 201, 202, 203, 204, 206];

  const okSet = new Set<number>(opts?.allowedStatuses ?? defaultStatuses);
  expect(okSet.has(readStatus(res))).toBeTruthy();
}

export async function gotoOk(
  page: Page,
  path: string,
  opts?: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle";
    allowRedirects?: boolean;
  },
): Promise<ResLike> {
  const res = await page.goto(path, { waitUntil: opts?.waitUntil ?? "domcontentloaded" });
  if (!res) throw new Error("Navigation returned null response");
  expectOk(res, { allowRedirects: opts?.allowRedirects });
  return res;
}

// ---- Healthcheck ----
export async function waitForHealth(
  baseUrl: string = BASE_URL,
  healthPath: string = E2E_SMOKE_PATH,
  timeoutMs = 15_000,
): Promise<void> {
  const client = await request.newContext({ baseURL: baseUrl });
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 0;

  while (Date.now() < deadline) {
    try {
      const res = await client.get(healthPath, { timeout: 5_000 });
      lastStatus = res.status();
      if (res.ok()) {
        await client.dispose();
        return;
      }
    } catch {
      // ignore, retry below
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  await client.dispose();
  throw new Error(`Healthcheck failed for ${baseUrl}${healthPath} (last status ${lastStatus})`);
}

// ---- Auth API helpers ----
export async function login(
  page: Page,
  data: { plan?: string; maxAge?: number } = {},
): Promise<APIResponse> {
  const res = await page.request.post("/api/login", { data });
  expect(res.ok()).toBeTruthy();
  return res;
}

export async function logout(page: Page): Promise<APIResponse> {
  const res = await page.request.post("/api/logout");
  expect(res.status()).toBe(204);
  return res;
}

/** Pose un cookie depuis la variable d'env E2E_SESSION_COOKIE (format Set-Cookie). */
export async function setSessionCookieFromEnv(
  context: BrowserContext,
  baseUrl: string = BASE_URL,
): Promise<void> {
  const raw = process.env.E2E_SESSION_COOKIE?.trim() ?? "";
  if (!raw) return;

  const parts = raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const cookieKV = parts.shift() ?? "";
  const eq = cookieKV.indexOf("=");
  if (eq < 0) throw new Error('E2E_SESSION_COOKIE must be "name=value; Attr=...";');

  const name = cookieKV.slice(0, eq);
  const value = cookieKV.slice(eq + 1);

  const attrs = new Map<string, string | true>();
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i === -1) attrs.set(p.toLowerCase(), true);
    else attrs.set(p.slice(0, i).toLowerCase(), p.slice(i + 1));
  }

  const url = new URL(baseUrl);
  const domain = (attrs.get("domain") as string | undefined)?.replace(/^\./, "") ?? url.hostname;
  const path = (attrs.get("path") as string | undefined) ?? "/";

  const sameSiteAttr = (attrs.get("samesite") as string | undefined)?.toLowerCase() ?? "lax";
  const sameSite: "Strict" | "Lax" | "None" =
    sameSiteAttr === "none" ? "None" : sameSiteAttr === "strict" ? "Strict" : "Lax";

  await context.addCookies([
    {
      name,
      value,
      domain,
      path,
      httpOnly: attrs.has("httponly"),
      secure: attrs.has("secure"),
      sameSite,
    },
  ]);
}

// ---- UI helper ----
export async function isPaywallVisible(
  page: Page,
  customSelector?: string,
  timeoutMs = 5_000,
): Promise<boolean> {
  const selectors = (
    [
      customSelector,
      '[data-test="paywall"]',
      '[data-testid="paywall"]',
      "section.paywall",
      ".paywall",
      "#paywall",
    ].filter(Boolean)
  ) as string[];

  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      if ((await loc.count()) > 0 && (await loc.isVisible({ timeout: timeoutMs }))) return true;
    } catch {
      // ignore
    }
  }

  // Fallback texte (FR/EN)
  const byText = page
    .locator("body")
    .getByText(/subscribe|upgrade|premium|paywall|sign in|log in|abonne(?:ment)?|premium/i, {
      exact: false,
    })
    .first();

  try {
    if ((await byText.count()) && (await byText.isVisible({ timeout: timeoutMs }))) return true;
  } catch {
    // ignore
  }

  return false;
}

// ---- Redirection -> /paywall ----
function normalizePath(p: string): string {
  if (!p) return "/";
  let n = p.replace(/\/{2,}/g, "/");
  if (!n.startsWith("/")) n = "/" + n;
  return n;
}

export function expectRedirectToPaywall(res: ResLike | null | undefined, fromPath = "/pro"): void {
  const status = readStatus(res);
  const okStatus = new Set([301, 302, 303, 307, 308, 200, 401, 403, 404]);
  expect(okStatus.has(status)).toBeTruthy();

  const loc = getHeader(res, "location");
  const xPaywall = headerValue(res, "x-paywall");

  if (loc) {
    const u = new URL(loc, BASE_URL);
    expect(u.pathname).toBe("/paywall");

    const from = u.searchParams.get("from");
    const fromSame = normalizePath(decodeURIComponent(from ?? "")) === normalizePath(fromPath);
    expect(fromSame).toBeTruthy();
    return;
  }

  expect(xPaywall && xPaywall !== "0").toBeTruthy();
}

// Chaîne de redirections: récupère la première Response (celle du 307/302 initial)
export async function firstRedirectResponse(
  res: import("@playwright/test").Response | null,
): Promise<import("@playwright/test").Response | null> {
  if (!res) return null;

  let first: import("@playwright/test").Response | null = res;
  let prevReq = res.request().redirectedFrom();

  while (prevReq) {
    const prevRes = await prevReq.response();
    if (!prevRes) break;
    first = prevRes;
    prevReq = prevRes.request().redirectedFrom();
  }
  return first;
}
