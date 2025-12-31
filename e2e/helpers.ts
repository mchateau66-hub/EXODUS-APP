// e2e/helpers.ts
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  expect,
  request,
  type Page,
  type APIResponse,
  type BrowserContext,
} from "@playwright/test";

/**
 * Exports (compat):
 *  BASE_URL, E2E_SMOKE_PATH, IS_LOCAL_BASE, IS_REMOTE_BASE
 *  readStatus, headerValue, getHeader,
 *  expectOk, gotoOk, waitForHealth,
 *  login, logout, setSessionCookieFromEnv,
 *  isPaywallVisible, expectRedirectToPaywall, firstRedirectResponse
 *
 * Extras (nouveaux):
 *  ORIGIN, originHeaders, envBool, envInt,
 *  ensureAnon, setPlanCookie,
 *  acquireSatToken
 */

type PWResponse = import("@playwright/test").Response;
type FetchResponse = globalThis.Response;
export type ResLike = APIResponse | PWResponse | FetchResponse;

const CI = !!process.env.CI;

function log(...args: any[]) {
  if (CI) console.log("[e2e]", ...args);
}

// ------------------------------
// Base URL / env helpers
// ------------------------------
function normalizeBaseUrl(raw: string) {
  const base = (raw || "").trim().replace(/\/+$/, "");
  let u: URL;
  try {
    u = new URL(base);
  } catch {
    throw new Error(`[e2e] Invalid E2E_BASE_URL: "${raw}"`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(
      `[e2e] E2E_BASE_URL must start with http(s)://, got "${u.protocol}"`
    );
  }
  if (!u.hostname) throw new Error(`[e2e] E2E_BASE_URL has no hostname: "${base}"`);

  // Local: forcer 127.0.0.1 pour stabiliser les cookies
  if (u.hostname === "localhost") u.hostname = "127.0.0.1";

  return u.toString().replace(/\/+$/, "");
}

function normalizePath(p: string) {
  let s = (p || "").trim();
  if (!s) s = "/api/health";
  if (!s.startsWith("/")) s = `/${s}`;
  return s.replace(/\/{2,}/g, "/");
}

export function envBool(name: string, def = false) {
  const v = process.env[name];
  if (v == null) return def;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

export function envInt(name: string, def: number) {
  const v = process.env[name];
  if (!v) return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

export const BASE_URL = normalizeBaseUrl(process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000");
export const ORIGIN = new URL(BASE_URL).origin;

export const E2E_SMOKE_PATH = normalizePath(process.env.E2E_SMOKE_PATH ?? "/api/health");

function isLocalBase(u: string) {
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
  } catch {
    return true;
  }
}
export const IS_LOCAL_BASE = isLocalBase(BASE_URL);
export const IS_REMOTE_BASE = !IS_LOCAL_BASE;

// ------------------------------
// status / headers helpers
// ------------------------------
function hasStatusFn(r: unknown): r is { status(): number } {
  return typeof (r as any)?.status === "function";
}
function hasStatusNumber(r: unknown): r is { status: number } {
  return typeof (r as any)?.status === "number";
}
export function readStatus(r: ResLike | null | undefined): number {
  if (!r) return 0;
  if (hasStatusFn(r)) return r.status();
  if (hasStatusNumber(r)) return (r as any).status;
  return 0;
}

function headersOf(res: unknown): Record<string, string> | null {
  const any = res as any;

  // Fetch Response (Headers)
  if (any?.headers && typeof any.headers.get === "function") {
    const out: Record<string, string> = {};
    for (const [k, v] of any.headers.entries()) out[k.toLowerCase()] = v;
    return out;
  }

  // Playwright APIResponse / PWResponse
  if (typeof any?.headers === "function") {
    const rec = (any.headers() as Record<string, string>) ?? {};
    const out: Record<string, string> = {};
    for (const k of Object.keys(rec)) out[k.toLowerCase()] = rec[k] ?? "";
    return out;
  }

  // plain object
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
  return rec[name.toLowerCase()] ?? null;
}
export const getHeader = (res: unknown, name: string) => headerValue(res, name);

// ------------------------------
// Assertions / goto
// ------------------------------
export function expectOk(
  res: ResLike | null | undefined,
  opts?: { allowRedirects?: boolean; allowedStatuses?: number[]; hint?: string },
): void {
  if (!res) throw new Error("HTTP response is null");

  const allowRedirects = opts?.allowRedirects ?? false;
  const defaultStatuses = allowRedirects
    ? [200, 201, 202, 203, 204, 206, 301, 302, 303, 307, 308]
    : [200, 201, 202, 203, 204, 206];

  const okSet = new Set<number>(opts?.allowedStatuses ?? defaultStatuses);
  const st = readStatus(res);

  if (!okSet.has(st)) {
    const url = (res as any)?.url?.() ?? (res as any)?.url ?? "";
    throw new Error(
      `[e2e] expectOk failed: status=${st}${url ? ` url=${url}` : ""}${opts?.hint ? ` hint=${opts.hint}` : ""}`
    );
  }
  expect(okSet.has(st)).toBeTruthy();
}

export async function gotoOk(
  page: Page,
  pathOrUrl: string,
  opts?: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle";
    allowRedirects?: boolean;
  },
): Promise<ResLike> {
  const res = await page.goto(pathOrUrl, { waitUntil: opts?.waitUntil ?? "domcontentloaded" });
  if (!res) throw new Error("Navigation returned null response");
  expectOk(res, { allowRedirects: opts?.allowRedirects, hint: `goto(${pathOrUrl})` });
  return res;
}

// ------------------------------
// Healthcheck robuste (candidates + retry)
// ------------------------------
function buildHealthCandidates(primary: string) {
  const candidates = [
    normalizePath(primary),
    "/api/health",
    "/api/health/ready",
    "/api/healthz",
    "/api/status",
    "/health",
    "/",
  ];

  const seen = new Set<string>();
  return candidates.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
}

export async function waitForHealth(
  baseUrl: string = BASE_URL,
  healthPath: string = E2E_SMOKE_PATH,
  timeoutMs = 20_000,
): Promise<{ usedPath: string; status: number }> {
  const base = normalizeBaseUrl(baseUrl);
  const paths = buildHealthCandidates(healthPath);

  const client = await request.newContext({
    baseURL: base,
    ignoreHTTPSErrors: envBool("E2E_IGNORE_HTTPS_ERRORS", false),
  });

  const deadline = Date.now() + timeoutMs;
  let last: { url: string; status: number; err?: string } = { url: "", status: 0 };

  while (Date.now() < deadline) {
    for (const p of paths) {
      try {
        const res = await client.get(p, { timeout: 6_000, headers: { accept: "application/json" } });
        const st = res.status();
        last = { url: `${base}${p}`, status: st };

        // ✅ reachable: 2xx/3xx
        if (st >= 200 && st < 400) {
          await client.dispose();
          process.env.E2E_SMOKE_PATH = p; // utile aux specs
          log("health OK:", `${base}${p}`, "status=", st);
          return { usedPath: p, status: st };
        }
      } catch (e: any) {
        last = { url: `${base}${p}`, status: 0, err: String(e?.message ?? e) };
      }
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  await client.dispose();
  throw new Error(
    `Healthcheck failed (base=${base}) after ${timeoutMs}ms. ` +
      `Last: url=${last.url} status=${last.status}${last.err ? ` err=${last.err}` : ""}`,
  );
}

// ------------------------------
// Headers same-origin + x-e2e
// ------------------------------
export function originHeaders(baseUrl: string = BASE_URL): Record<string, string> {
  const origin = new URL(baseUrl).origin;
  return {
    accept: "application/json",
    "content-type": "application/json",
    origin,
    referer: `${origin}/`,
    "x-e2e": "1",
  };
}

// ------------------------------
// Cookies helpers
// ------------------------------
function cookieUrlForBase(baseUrl: string) {
  return new URL(baseUrl).origin;
}

export async function setPlanCookie(
  context: BrowserContext,
  plan: "free" | "master" | "premium" | "pro" = "free",
  baseUrl: string = BASE_URL,
): Promise<void> {
  const p = (plan === "pro" ? "premium" : plan).toLowerCase() as any;
  await context.addCookies([
    {
      name: "plan",
      value: p,
      url: cookieUrlForBase(baseUrl), // ✅ Playwright requires url OR domain+path
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
      secure: new URL(baseUrl).protocol === "https:",
    },
  ]);
}

export async function ensureAnon(page: Page): Promise<void> {
  await page.context().clearCookies();

  // clear storages avant navigation
  await page.addInitScript(() => {
    try {
      window.localStorage?.clear();
      window.sessionStorage?.clear();
    } catch {}
  });
}

/**
 * Parse E2E_SESSION_COOKIE:
 * - "sid=xxx"
 * - "sid=xxx; Path=/; Secure; SameSite=Lax; HttpOnly; Domain=..."
 * - "Set-Cookie: sid=xxx; ..."
 * - multi-lignes (1 cookie / ligne)
 */
function splitCookieLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^set-cookie:\s*/i, ""));
}

function parseCookieLine(line: string) {
  const parts = line
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const cookieKV = parts.shift() ?? "";
  const eq = cookieKV.indexOf("=");
  if (eq < 0) throw new Error(`[e2e] Invalid cookie (expected name=value): "${cookieKV}"`);

  const name = cookieKV.slice(0, eq);
  const value = cookieKV.slice(eq + 1);

  const attrs = new Map<string, string | true>();
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i === -1) attrs.set(p.toLowerCase(), true);
    else attrs.set(p.slice(0, i).toLowerCase(), p.slice(i + 1));
  }

  const cookiePath = (attrs.get("path") as string | undefined) ?? "/";
  const sameSiteAttr =
    (attrs.get("samesite") as string | undefined)?.toLowerCase() ?? "lax";
  const sameSite: "Strict" | "Lax" | "None" =
    sameSiteAttr === "none" ? "None" : sameSiteAttr === "strict" ? "Strict" : "Lax";

  return { name, value, attrs, cookiePath, sameSite };
}

export async function setSessionCookieFromEnv(
  context: BrowserContext,
  baseUrl: string = BASE_URL,
): Promise<void> {
  const raw0 = (process.env.E2E_SESSION_COOKIE ?? "").trim();
  if (!raw0) return;

  const lines = splitCookieLines(raw0);
  if (!lines.length) return;

  const base = new URL(baseUrl);
  const origin = base.origin;

  // Injecte tous les cookies donnés (souvent 1 seul: sid=...)
  const cookies: any[] = [];
  for (const line of lines) {
    const { name, value, attrs, cookiePath, sameSite } = parseCookieLine(line);

    const domainAttr = (attrs.get("domain") as string | undefined)?.trim();
    const secure = attrs.has("secure") || base.protocol === "https:";

    const c: any = {
      name,
      value,
      path: cookiePath,
      httpOnly: attrs.has("httponly"),
      secure,
      sameSite,
      ...(domainAttr
        ? { domain: domainAttr.replace(/^\./, "") }
        : { url: origin }),
    };

    cookies.push(c);
  }

  await context.addCookies(cookies);
  log("session cookie(s) injected:", cookies.map((c) => c.name).join(", "));
}

// ------------------------------
// Auth helpers
// ------------------------------
function normalizePlan(plan?: string) {
  const p = (plan ?? "free").toLowerCase().trim();
  if (p === "pro") return "premium";
  return p;
}

export async function login(
  page: Page,
  data: { email?: string; plan?: string; maxAge?: number } = {},
): Promise<APIResponse> {
  const plan = normalizePlan(data.plan);

  // Remote: /api/login souvent désactivé => cookie requis
  if (IS_REMOTE_BASE) {
    const raw = process.env.E2E_SESSION_COOKIE?.trim() ?? "";
    if (!raw) {
      throw new Error(
        `[e2e] login() called on REMOTE base (${BASE_URL}) but E2E_SESSION_COOKIE is empty.\n` +
          `Solution: ajoute un secret E2E_SESSION_COOKIE (format "sid=...; Path=/; Secure; SameSite=Lax")\n` +
          `ou skip les tests auth en remote.`,
      );
    }

    // inject cookie (idempotent)
    await setSessionCookieFromEnv(page.context(), BASE_URL);

    // ping health pour valider "reachable"
    const hp = normalizePath(process.env.E2E_SMOKE_PATH ?? E2E_SMOKE_PATH);
    const res = await page.request.get(hp, { headers: { accept: "application/json" } });
    expect(res.status(), `remote login reachability status=${res.status()}`).toBeLessThan(400);
    return res;
  }

  // Local: backdoor login
  const email =
    (data.email ??
      process.env.E2E_TEST_EMAIL ??
      `e2e+${randomUUID()}@exodus.local`).trim();

  const payload = { email, plan, maxAge: data.maxAge };

  const res = await page.request.post("/api/login", {
    data: payload,
    headers: originHeaders(),
  });

  if (res.status() >= 400) {
    const body = await res.text().catch(() => "");
    console.error(`[e2e] /api/login failed: status=${res.status()} url=${res.url()}`);
    console.error(body.slice(0, 1200));
  }

  expect(res.status(), `/api/login status=${res.status()}`).toBeLessThan(400);
  return res;
}

export async function logout(page: Page): Promise<APIResponse> {
  const res = await page.request.post("/api/logout", { headers: originHeaders() });

  if (res.status() >= 400) {
    const body = await res.text().catch(() => "");
    console.error(`[e2e] /api/logout failed: status=${res.status()} url=${res.url()}`);
    console.error(body.slice(0, 1200));
  }

  return res;
}

// ------------------------------
// SAT helpers (lock + backoff)
// ------------------------------
function jitter(ms: number) {
  return ms + Math.floor(Math.random() * 120);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function withFileLock<T>(
  lockName: string,
  fn: () => Promise<T>,
  timeoutMs = 25_000,
): Promise<T> {
  const dir = path.join(process.cwd(), ".pw");
  const lockFile = path.join(dir, lockName);
  await fs.mkdir(dir, { recursive: true }).catch(() => {});

  const deadline = Date.now() + timeoutMs;

  while (true) {
    try {
      const handle = await fs.open(lockFile, "wx"); // fail if exists
      try {
        return await fn();
      } finally {
        await handle.close().catch(() => {});
        await fs.unlink(lockFile).catch(() => {});
      }
    } catch (e: any) {
      if (e?.code !== "EEXIST") throw e;
      if (Date.now() > deadline) throw new Error(`[e2e] lock timeout: ${lockFile}`);
      await sleep(jitter(180));
    }
  }
}

function parseRateLimitResetMs(res: APIResponse) {
  const h =
    headerValue(res, "ratelimit-reset") ??
    headerValue(res, "RateLimit-Reset") ??
    headerValue(res, "x-ratelimit-reset");

  if (!h) return null;

  // Deux formats possibles:
  // - epoch seconds
  // - delta seconds (rare)
  const n = Number(h);
  if (!Number.isFinite(n) || n <= 0) return null;

  // heuristique: si > 10^10 => ms, si > 10^9 => epoch seconds
  if (n > 1e12) return n - Date.now();
  if (n > 1e9) return n * 1000 - Date.now();
  return n * 1000; // delta seconds
}

/**
 * Acquire SAT token avec:
 * - lock inter-workers (.pw/sat.lock)
 * - backoff exponentiel + respect ratelimit-reset si présent
 *
 * opts.payload: envoyé tel quel à /api/sat
 * opts.maxAttempts: défaut 8
 */
export async function acquireSatToken(
  page: Page,
  opts?: {
    payload?: Record<string, any>;
    maxAttempts?: number;
    lockTimeoutMs?: number;
  }
): Promise<string> {
  const maxAttempts = opts?.maxAttempts ?? 8;

  return await withFileLock(
    "sat.lock",
    async () => {
      let lastStatus = 0;
      let lastBody = "";

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const payload = opts?.payload ?? { nonce: randomUUID() };

        const res = await page.request.post("/api/sat", {
          data: payload,
          headers: originHeaders(),
        });

        lastStatus = res.status();
        lastBody = await res.text().catch(() => "");

        if (lastStatus >= 200 && lastStatus < 300) {
          const json = (() => {
            try { return JSON.parse(lastBody || "{}"); } catch { return null; }
          })();

          const token = json?.token || json?.sat || json?.jwt;
          if (!token || typeof token !== "string") {
            throw new Error(
              `[e2e] /api/sat 2xx but missing token field. body=${(lastBody || "").slice(0, 700)}`
            );
          }
          return token;
        }

        // 401/403 : session/entitlements/CSRF → pas de retry infini
        if (lastStatus === 401 || lastStatus === 403) {
          throw new Error(
            `[e2e] Unable to acquire SAT token (status=${lastStatus}). ` +
              `Check session cookie / entitlements. body=${(lastBody || "").slice(0, 700)}`
          );
        }

        const retryable =
          lastStatus === 429 ||
          lastStatus === 408 ||
          lastStatus === 500 ||
          lastStatus === 502 ||
          lastStatus === 503 ||
          lastStatus === 504;

        if (!retryable) {
          throw new Error(
            `[e2e] Unable to acquire SAT token (status=${lastStatus}). body=${(lastBody || "").slice(0, 700)}`
          );
        }

        // backoff: d’abord ratelimit-reset si dispo
        const resetMs = parseRateLimitResetMs(res);
        const exp = 250 * Math.pow(2, attempt - 1);
        const wait = Math.min(6_000, Math.max(350, resetMs ?? jitter(exp)));

        log(`SAT retry attempt=${attempt}/${maxAttempts} status=${lastStatus} wait=${wait}ms`);
        await sleep(wait);
      }

      throw new Error(
        `Unable to acquire SAT token (rate-limited too long). last status=${lastStatus} body=${(lastBody || "").slice(0, 700)}`
      );
    },
    opts?.lockTimeoutMs ?? 25_000,
  );
}

// ------------------------------
// UI helpers / paywall
// ------------------------------
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
    } catch {}
  }

  const byText = page
    .locator("body")
    .getByText(/subscribe|upgrade|premium|paywall|sign in|log in|abonne(?:ment)?/i, {
      exact: false,
    })
    .first();

  try {
    if ((await byText.count()) && (await byText.isVisible({ timeout: timeoutMs }))) return true;
  } catch {}

  return false;
}

// ---- Redirect -> /paywall ----
function normalizePathForCompare(p: string): string {
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
    const fromSame =
      normalizePathForCompare(decodeURIComponent(from ?? "")) === normalizePathForCompare(fromPath);
    expect(fromSame).toBeTruthy();
    return;
  }

  expect(xPaywall && xPaywall !== "0").toBeTruthy();
}

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
