// e2e/contacts.spec.ts
import { test, expect, type Page } from "@playwright/test";
import { BASE_URL, waitForHealth, login, setSessionCookieFromEnv } from "./helpers";

const CONTACTS_PATH = "/api/contacts";
const COACH_SLUG = (process.env.E2E_CONTACTS_COACH_SLUG?.trim() || "marie") as string;

const HAS_SESSION_COOKIE = Boolean(process.env.E2E_SESSION_COOKIE?.trim());
const HAS_SAT_SECRET = Boolean(process.env.SAT_JWT_SECRET?.trim());

async function ensureAuth(page: Page, plan: "free" | "master" | "premium" = "premium") {
  if (HAS_SESSION_COOKIE) return;
  await login(page, { plan });
}

async function acquireSatForContacts(page: Page) {
  const r = await page.request.post("/api/sat", {
    headers: { origin: BASE_URL },
    data: {
      feature: "contacts.view",
      method: "GET",
      path: CONTACTS_PATH,
    },
  });

  const body = (await r.json().catch(() => ({}))) as any;
  return { status: r.status(), body };
}

test.describe("Contacts: SAT requis + anti-replay (/api/contacts)", () => {
  test.beforeAll(async () => {
    await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? "/api/health", 20_000);
  });

  test.beforeEach(async ({ context }) => {
    await setSessionCookieFromEnv(context);
  });

  test("1) Sans SAT → 403", async ({ page }) => {
    test.skip(!HAS_SAT_SECRET, "SAT_JWT_SECRET manquant: SAT non enforce (skip)");

    await ensureAuth(page, "premium");

    const res = await page.request.get(`${CONTACTS_PATH}?coachSlug=${encodeURIComponent(COACH_SLUG)}`, {
      headers: { origin: BASE_URL },
    });

    expect(res.status()).toBe(403);
    const json = (await res.json().catch(() => ({}))) as any;
    expect(json?.ok).toBe(false);
  });

  test("2) Avec SAT → (200 ou 404), re-use → 403", async ({ page }) => {
    test.skip(!HAS_SAT_SECRET, "SAT_JWT_SECRET manquant: SAT non enforce (skip)");

    await ensureAuth(page, "premium");

    const { status, body } = await acquireSatForContacts(page);
    expect(status).toBe(200);
    expect(body?.token).toBeTruthy();

    // 1ère requête avec SAT: doit passer le gate SAT (donc PAS 403)
    const ok = await page.request.get(`${CONTACTS_PATH}?coachSlug=${encodeURIComponent(COACH_SLUG)}`, {
      headers: {
        origin: BASE_URL,
        "x-sat": String(body.token),
      },
    });

    // Selon seed DB: coach peut exister (200) ou non (404), mais le point est: pas 403
    expect([200, 404]).toContain(ok.status());

    // 2ème requête avec le MÊME SAT: anti-replay => 403
    const replay = await page.request.get(`${CONTACTS_PATH}?coachSlug=${encodeURIComponent(COACH_SLUG)}`, {
      headers: {
        origin: BASE_URL,
        "x-sat": String(body.token),
      },
    });

    expect(replay.status()).toBe(403);
  });
});
