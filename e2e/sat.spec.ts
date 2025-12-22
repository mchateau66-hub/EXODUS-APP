// e2e/sat.spec.ts
import { test, expect, type Page } from "@playwright/test";
import { BASE_URL, waitForHealth, login, setSessionCookieFromEnv } from "./helpers";

const PATH = "/api/messages";
const FEATURE = (process.env.E2E_SAT_FEATURE?.trim() || "chat.media") as string;

const HAS_SESSION_COOKIE = Boolean(process.env.E2E_SESSION_COOKIE?.trim());
const HAS_SAT_SECRET = Boolean(process.env.SAT_JWT_SECRET?.trim());

async function ensureAuth(page: Page, plan: "free" | "master" | "premium" = "premium") {
  if (HAS_SESSION_COOKIE) return;
  await login(page, { plan });
}

async function acquireSAT(page: Page, feature = FEATURE, method = "POST", path = PATH) {
  const r = await page.request.post("/api/sat", {
    headers: { origin: BASE_URL },
    data: { feature, method, path },
  });

  const body = (await r.json().catch(() => ({}))) as any;
  return { status: r.status(), body };
}

test.describe("SAT requis + invalide + anti-replay (/api/messages)", () => {
  test.beforeAll(async () => {
    await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? "/api/health", 20_000);
  });

  test.beforeEach(async ({ context }) => {
    await setSessionCookieFromEnv(context);
  });

  test("1) Sans SAT → 403", async ({ page }) => {
    test.skip(!HAS_SAT_SECRET, "SAT_JWT_SECRET manquant: SAT non enforce (skip)");
    await ensureAuth(page, "premium");

    const res = await page.request.post(PATH, {
      headers: { origin: BASE_URL },
      data: { content: "hello" },
    });

    expect(res.status()).toBe(403);
    const json = (await res.json().catch(() => ({}))) as any;
    expect(json?.ok).toBe(false);
  });

  test("2) SAT invalide → 403", async ({ page }) => {
    test.skip(!HAS_SAT_SECRET, "SAT_JWT_SECRET manquant: SAT non enforce (skip)");
    await ensureAuth(page, "premium");

    const res = await page.request.fetch(PATH, {
      method: "POST",
      headers: {
        origin: BASE_URL,
        "content-type": "application/json",
        "x-sat": "this.is.not.a.jwt",
      },
      data: { content: "hello invalid sat" },
    });

    expect(res.status()).toBe(403);
    const json = (await res.json().catch(() => ({}))) as any;
    expect(json?.ok).toBe(false);
  });

  test("3) Avec SAT → 200, re-use → 403", async ({ page }) => {
    test.skip(!HAS_SAT_SECRET, "SAT_JWT_SECRET manquant: SAT non enforce (skip)");
    await ensureAuth(page, "premium");

    const { status, body } = await acquireSAT(page);
    expect(status).toBe(200);
    expect(body?.token).toBeTruthy();

    const ok = await page.request.fetch(PATH, {
      method: "POST",
      headers: {
        origin: BASE_URL,
        "content-type": "application/json",
        "x-sat": String(body.token),
      },
      data: { content: "envoi avec sat" },
    });
    expect(ok.status()).toBe(200);

    const replay = await page.request.fetch(PATH, {
      method: "POST",
      headers: {
        origin: BASE_URL,
        "content-type": "application/json",
        "x-sat": String(body.token),
      },
      data: { content: "replay" },
    });
    expect(replay.status()).toBe(403);
  });
});
