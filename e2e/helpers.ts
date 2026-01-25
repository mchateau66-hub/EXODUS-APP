// e2e/helpers.ts
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { expect, request, type Page, type APIResponse, type BrowserContext } from "@playwright/test";

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
    throw new Error(`[e2e] E2E_BASE_URL must start with http(s)://, got "${u.protocol}"`);
  }
  if (!u.hostname) throw new Error(`[e2e] E2E_BASE_URL has no hostname: "${base}"`);

  // Local: forcer 127.0.0.1 pour stabiliser cookies host-only
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
      `[e2e] expectOk failed: status=${st}${url ? ` url=${url}` : ""}${opts?.hint ? ` hint=${opts.hint}` : ""}`,
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
// Headers
// ------------------------------
export function e2eBaseHeaders(baseUrl: string = BASE_URL): Record<string, string> {
  const origin = new URL(baseUrl).origin;

  const headers: Record<string, string> = {
    origin,
    referer: `${origin}/`,
  };

  // Remote seulement
  if (IS_REMOTE_BASE) {
    headers["x-e2e"] = "1";

    const bypass = (process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "").trim();
    if (bypass) {
      headers["x-vercel-protection-bypass"] = bypass;
      headers["x-vercel-set-bypass-cookie"] = "true";
    }

    const token = (process.env.E2E_DEV_LOGIN_TOKEN ?? "").trim();
    if (token) headers["x-e2e-token"] = token;
  }

  return headers;
}
export function originHeaders(baseUrl: string = BASE_URL): Record<string, string> {
  const origin = new URL(baseUrl).origin;

  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
    origin,
    referer: `${origin}/`,
  };

  // Remote seulement
  if (IS_REMOTE_BASE) {
    headers["x-e2e"] = "1";

    const token = (process.env.E2E_DEV_LOGIN_TOKEN ?? "").trim();
    if (token) headers["x-e2e-token"] = token;

    const bypass = (process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "").trim();
    if (bypass) {
      headers["x-vercel-protection-bypass"] = bypass;
      headers["x-vercel-set-bypass-cookie"] = "true";
    }
  }

  return headers;
}

export async function resetAuthState(page: Page): Promise<void> {
  const ctx = page.context();
  await ctx.clearCookies();

  await page.addInitScript(() => {
    try {
      window.localStorage?.clear();
      window.sessionStorage?.clear();
    } catch {}
  });

  // Local: pas de x-e2e global.
  await ctx.setExtraHTTPHeaders(
    IS_REMOTE_BASE ? e2eBaseHeaders() : { origin: ORIGIN, referer: `${ORIGIN}/` },
  );
}

// ------------------------------
// Healthcheck
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
    extraHTTPHeaders: originHeaders(base),
  });

  const deadline = Date.now() + timeoutMs;
  let last: { url: string; status: number; err?: string } = { url: "", status: 0 };

  while (Date.now() < deadline) {
    for (const p of paths) {
      try {
        const res = await client.get(p, { timeout: 6_000 });
        const st = res.status();
        last = { url: `${base}${p}`, status: st };
        if (st >= 200 && st < 400) {
          await client.dispose();
          process.env.E2E_SMOKE_PATH = p;
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
// Cookies helpers
// ------------------------------
export async function setPlanCookie(
  context: BrowserContext,
  plan: "free" | "master" | "premium" | "pro" = "free",
  baseUrl: string = BASE_URL,
): Promise<void> {
  const normalized = (plan === "pro" ? "premium" : plan).toLowerCase();
  const origin = new URL(baseUrl).origin;
  const secure = new URL(baseUrl).protocol === "https:";

  await context.addCookies([
    {
      name: "plan",
      value: normalized,
      url: origin, // ✅ stable
      secure,
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
}

export async function assertSessionCookies(page: Page, baseUrl: string = BASE_URL): Promise<void> {
  const origin = new URL(baseUrl).origin;
  const cookies = await page.context().cookies(origin);
  const hasSession = cookies.some((c) => c.name === "sid" || c.name === "session");
  expect(hasSession, `Missing sid/session cookie in browser context for origin=${origin}`).toBeTruthy();
}

// ------------------------------
// Parse E2E_SESSION_COOKIE and inject into context (remote mode)
// ------------------------------
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

  if (eq < 0) {
    const name = (process.env.E2E_SESSION_COOKIE_NAME ?? "sid").trim() || "sid";
    const value = cookieKV.trim();
    if (!value) throw new Error(`[e2e] Invalid cookie (empty value)`);
    return {
      name,
      value,
      attrs: new Map<string, string | true>(),
      cookiePath: "/",
      sameSite: "Lax" as const,
    };
  }

  const name = cookieKV.slice(0, eq);
  const value = cookieKV.slice(eq + 1);

  const attrs = new Map<string, string | true>();
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i === -1) attrs.set(p.toLowerCase(), true);
    else attrs.set(p.slice(0, i).toLowerCase(), p.slice(i + 1));
  }

  const cookiePath = (attrs.get("path") as string | undefined) ?? "/";
  const sameSiteAttr = ((attrs.get("samesite") as string | undefined) ?? "lax").toLowerCase();
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

  const cookies: any[] = [];
  for (const line of lines) {
    const { name, value, attrs, cookiePath, sameSite } = parseCookieLine(line);

    const domainAttr = (attrs.get("domain") as string | undefined)?.trim();
    const secure = attrs.has("secure") || base.protocol === "https:";

    cookies.push({
      name,
      value,
      path: cookiePath,
      httpOnly: attrs.has("httponly"),
      secure,
      sameSite,
      ...(domainAttr ? { domain: domainAttr.replace(/^\./, "") } : { url: origin }),
    });
  }

  await context.addCookies(cookies);
  log("session cookie(s) injected:", cookies.map((c) => c.name).join(", "));
}

// ------------------------------
// Auth helpers
// ------------------------------
type Role = "athlete" | "coach" | "admin";

function normalizePlan(plan?: string) {
  const p = (plan ?? "free").toLowerCase().trim();
  if (p === "pro") return "premium";
  return p;
}

function normalizeRole(role?: string): Role {
  const r = (role ?? process.env.E2E_TEST_ROLE ?? "athlete").toLowerCase().trim();
  if (r === "coach" || r === "admin") return r;
  return "athlete";
}

async function tryLoginCandidates(page: Page, candidates: string[], payload: any): Promise<APIResponse> {
  let lastRes: APIResponse | null = null;
  let lastBody = "";

  const headers = originHeaders();

  for (const p of candidates) {
    const path = normalizePath(p);

    // 1) POST (normal)
    const resPost = await page.request.post(path, { data: payload, headers });
    lastRes = resPost;

    if (resPost.status() < 400) return resPost;

    // 2) Si 405 => fallback GET (pratique si /api/dev/login n'exporte que GET)
    if (resPost.status() === 405) {
      const resGet = await page.request.get(path, { params: payload, headers });
      lastRes = resGet;

      if (resGet.status() < 400) return resGet;
      lastBody = await resGet.text().catch(() => "");
      continue;
    }

    lastBody = await resPost.text().catch(() => "");
  }

  const status = lastRes?.status() ?? 0;
  const url = lastRes?.url?.() ?? "";
  throw new Error(
    `[e2e] login failed after trying ${candidates.join(", ")}. ` +
      `lastStatus=${status} lastUrl=${url} body=${(lastBody || "").slice(0, 900)}`,
  );
}

export async function login(
  page: Page,
  data: {
    email?: string;
    plan?: string;
    role?: Role | string;
    onboardingStep?: number;
    maxAgeSeconds?: number;
  } = {},
): Promise<APIResponse> {
  await resetAuthState(page);

  if (envBool("E2E_SKIP_LOGIN", false)) {
    throw new Error(
      `[e2e] login() called but E2E_SKIP_LOGIN=1.\n` +
        `➡️ Smoke doit éviter le login. Retire l'appel à login() (ou désactive globalSetup storageState).`,
    );
  }

  const plan = normalizePlan(data.plan);
  const role = normalizeRole(data.role);

  const email =
    (data.email ?? process.env.E2E_TEST_EMAIL ?? `e2e+${randomUUID()}@exodus.local`).trim();

  const onboardingStep =
    typeof data.onboardingStep === "number" && Number.isFinite(data.onboardingStep)
      ? Math.floor(data.onboardingStep)
      : 3;

  const payload: any = { email, plan, role, onboardingStep };
  if (typeof data.maxAgeSeconds === "number" && data.maxAgeSeconds > 0) {
    payload.maxAgeSeconds = Math.floor(data.maxAgeSeconds);
  }

  // Remote
  if (IS_REMOTE_BASE) {
    const rawCookie = (process.env.E2E_SESSION_COOKIE ?? "").trim();
    if (rawCookie) {
      await setSessionCookieFromEnv(page.context(), BASE_URL);
      const hp = normalizePath(process.env.E2E_SMOKE_PATH ?? E2E_SMOKE_PATH);
      const res = await page.request.get(hp, { headers: originHeaders() });
      expect(res.status(), `remote reachability status=${res.status()}`).toBeLessThan(400);
      return res;
    }

    const token = (process.env.E2E_DEV_LOGIN_TOKEN ?? "").trim();
    if (token) {
      const candidates = [
        process.env.E2E_DEV_LOGIN_PATH ?? "/api/login",
        "/api/e2e/login",
        "/api/dev/login",
      ];
      const res = await tryLoginCandidates(page, candidates, payload);
      await assertSessionCookies(page);
      return res;
    }

    throw new Error(
      `[e2e] login() on REMOTE base (${BASE_URL}) but no auth method is configured.\n` +
        `Provide ONE of:\n` +
        `  - E2E_SESSION_COOKIE\n` +
        `  - E2E_DEV_LOGIN_TOKEN (+ ALLOW_DEV_LOGIN=1)\n` +
        `Also, if Preview is protected, provide VERCEL_AUTOMATION_BYPASS_SECRET.`,
    );
  }

  // Local
  const candidates = [
    process.env.E2E_DEV_LOGIN_PATH ?? "/api/login",
    "/api/e2e/login",
    "/api/dev/login",
  ];

  const res = await tryLoginCandidates(page, candidates, payload);
  await assertSessionCookies(page);
  return res;
}
