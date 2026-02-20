// e2e/hub-myads.spec.ts
import { test, expect, type Page, type Locator, type TestInfo } from "@playwright/test";
import { login, BASE_URL, setPlanCookie } from "./helpers";
import { stubLeafletTiles } from "./utils/leaflet";
import { getMyAdsSection, ensureNotHidingNonVisible, myAdsCardById, myAdsCardByTitleFallback } from "./utils/selectors";
import {
  ensureOutputDir,
  writeDebugFile,
  dump,
  attachAllDebugFilesFromOutputDir,
} from "./utils/dump";

/**
 * Headers "safe" (ne touche PAS au Cookie),
 * laisse Playwright envoyer les cookies du browser context.
 */
function apiHeaders(origin: string) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Pragma: "no-cache",
    Origin: origin,
    Referer: `${origin}/hub`,
  };
}

function makeTitle() {
  return `e2e-ad-${Date.now()}`;
}

/** Use the same origin as the browser page to guarantee cookies/session match */
function getPageOrigin(page: Page) {
  const u = page.url();
  return u ? new URL(u).origin : new URL(BASE_URL).origin;
}

async function createAdViaApi(page: Page, origin: string, title: string, testInfo: TestInfo) {
  const payload = { title, sport: "Running", city: "Paris", country: "FR", language: "fr" };
  const url = new URL("/api/ads", origin).toString();

  await writeDebugFile(testInfo, "create-ad-origin.txt", origin);
  await writeDebugFile(testInfo, "create-ad-url.txt", url);
  await writeDebugFile(testInfo, "create-ad-payload.json", JSON.stringify(payload, null, 2));

  let res: any;
  let txt = "";

  try {
    res = await page.request.post(url, {
      data: payload,
      headers: apiHeaders(origin),
      timeout: 30_000,
    });
    txt = await res.text().catch(() => "");
  } catch (e: any) {
    await writeDebugFile(testInfo, "create-ad-error.txt", String(e?.message || e || "unknown"));
    throw e;
  }

  await writeDebugFile(testInfo, "create-ad-status.txt", String(res.status()));
  await writeDebugFile(testInfo, "create-ad-body.json", (txt || "").slice(0, 20_000));

  expect(res.ok(), `POST /api/ads failed: ${res.status()} ${(txt || "").slice(0, 900)}`).toBeTruthy();

  let json: any = null;
  try {
    json = JSON.parse(txt || "{}");
  } catch {}

  const id = json?.id || json?.item?.id || json?.ad?.id || json?.data?.id || null;
  return { id, raw: json };
}

async function getAdsViaApi(page: Page, origin: string, testInfo: TestInfo, tag: string) {
  const url = new URL("/api/ads", origin).toString();

  const res = await page.request.get(url, {
    headers: apiHeaders(origin),
    timeout: 30_000,
  });

  const txt = await res.text().catch(() => "");

  await writeDebugFile(testInfo, `${tag}-ads-url.txt`, url);
  await writeDebugFile(testInfo, `${tag}-ads-status.txt`, String(res.status()));
  await writeDebugFile(testInfo, `${tag}-ads-body.json`, (txt || "").slice(0, 40_000));

  return { status: res.status(), bodyText: txt };
}

function containsId(x: any, id: string): boolean {
  if (!x) return false;
  if (typeof x === "string") return x === id || x.includes(id);
  if (Array.isArray(x)) return x.some((v) => containsId(v, id));
  if (typeof x === "object") return Object.values(x).some((v) => containsId(v, id));
  return false;
}

function isAdsListGET(url: string, method: string) {
  if (method !== "GET") return false;
  const u = new URL(url);
  // cible /api/ads (list "mes annonces"), pas /api/hub/ads (map)
  return /\/api\/ads\b/.test(u.pathname);
}

function isAdMutation(url: string, method: string, adId: string) {
  const u = new URL(url);
  if (!u.pathname.includes(`/api/ads/${adId}`)) return false;
  return method === "PATCH" || method === "PUT" || method === "POST";
}

/**
 * Click "Rafraîchir" et attend la requête + réponse associées sur /api/ads
 */
async function refresh(scope: Locator, page: Page, testInfo: TestInfo) {
  const ctl = scope
    .getByRole("button", { name: /rafraîchir|rafraichir/i })
    .or(scope.getByRole("link", { name: /rafraîchir|rafraichir/i }))
    .or(scope.getByText(/^Rafraîchir$/i));

  if ((await ctl.count().catch(() => 0)) === 0) {
    await writeDebugFile(testInfo, "refresh-not-found.txt", "Refresh control not found in scope");
    throw new Error("Refresh control not found");
  }

  const reqP = page.waitForRequest((req) => isAdsListGET(req.url(), req.method()), { timeout: 15_000 });
  await ctl.first().click({ timeout: 10_000 });

  const req = await reqP;
  const resp = await page.waitForResponse((r) => r.request() === req && r.status() >= 200 && r.status() < 400, {
    timeout: 15_000,
  });

  const txt = await resp.text().catch(() => "");
  await writeDebugFile(testInfo, "refresh-ads-http.txt", `${resp.status()} ${resp.url()}`);
  await writeDebugFile(testInfo, "refresh-ads-body.json", (txt || "").slice(0, 40_000));
}

async function waitAdPatch(page: Page, adId: string) {
  const req = await page.waitForRequest((r) => isAdMutation(r.url(), r.method(), adId), { timeout: 20_000 });

  return page.waitForResponse((res) => res.request() === req && res.status() >= 200 && res.status() < 400, {
    timeout: 20_000,
  });
}

test.beforeEach(async (_ctx, testInfo) => {
  await ensureOutputDir(testInfo);
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await dump(page, testInfo, "failed");
    await attachAllDebugFilesFromOutputDir(
      testInfo,
      /^(step-|page-origin|create-ad-|created-ad-|post-create-|refresh-ads-|ad-not-visible|ads-missing-in-api)/i
    );
  }
});

test("hub: my ads list + deactivate/relaunch works", async ({ page }, testInfo) => {
  test.setTimeout(120_000);

  await writeDebugFile(testInfo, "step-00-start.txt", new Date().toISOString());

  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {}
    try {
      sessionStorage.clear();
    } catch {}
  });

  await stubLeafletTiles(page);

  await login(page, { role: "athlete", plan: "premium", onboardingStep: 3 });
  await writeDebugFile(testInfo, "step-10-after-login.txt", page.url());

  await setPlanCookie(page.context(), "premium");
  await writeDebugFile(testInfo, "step-20-after-cookie.txt", "ok");

  const hubUrl = new URL("/hub", BASE_URL).toString();
  await writeDebugFile(testInfo, "step-25-before-goto.txt", hubUrl);

  await page.goto(hubUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await writeDebugFile(testInfo, "step-30-after-goto.txt", page.url());

  await expect(page.getByText("Mes annonces", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await writeDebugFile(testInfo, "step-40-mes-annonces-visible.txt", "ok");

  const origin = getPageOrigin(page);
  await writeDebugFile(testInfo, "page-origin.txt", origin);

  const title = makeTitle();
  const created = await createAdViaApi(page, origin, title, testInfo);

  await writeDebugFile(testInfo, "created-ad-title.txt", title);
  await writeDebugFile(testInfo, "created-ad-id.txt", String(created.id ?? ""));
  expect(created.id, "API did not return an ad id").toBeTruthy();

  // sanity check API (post-create) avec retry
  let listJson: any = null;
  let found = false;

  for (let i = 1; i <= 6; i++) {
    const listCheck = await getAdsViaApi(page, origin, testInfo, `post-create-${i}`);
    try {
      listJson = JSON.parse(listCheck.bodyText || "null");
    } catch {
      listJson = null;
    }

    if (containsId(listJson, String(created.id))) {
      found = true;
      break;
    }
    await page.waitForTimeout(400);
  }

  if (!found) {
    await dump(page, testInfo, "ads-missing-in-api");
    throw new Error(
      `Created ad id=${created.id} NOT present in GET /api/ads after retries (session/cookie mismatch OR cache/consistency).`
    );
  }

  const myAds = await getMyAdsSection(page);
  await ensureNotHidingNonVisible(myAds);
  
  const cardById = myAdsCardById(myAds, String(created.id));
  const cardByTitleFallback = myAdsCardByTitleFallback(myAds, title);  

  for (let i = 1; i <= 6; i++) {
    await refresh(myAds, page, testInfo);

    const card = (await cardById.count().catch(() => 0)) > 0 ? cardById : cardByTitleFallback;

    try {
      await card.scrollIntoViewIfNeeded().catch(() => {});
      await expect(card, `Ad card should appear after refresh (try ${i}/6)`).toBeVisible({ timeout: 5_000 });
      break;
    } catch {
      if (i === 6) {
        await dump(page, testInfo, "ad-not-visible");
        throw new Error(`Created ad not visible after refresh (id=${created.id}, title=${title})`);
      }
      await page.waitForTimeout(700);
    }
  }

  const card = (await cardById.count().catch(() => 0)) > 0 ? cardById : cardByTitleFallback;

  const deactivate = card
    .getByRole("button", { name: /^désactiver$/i })
    .or(card.getByRole("link", { name: /^désactiver$/i }))
    .first();

  await expect(deactivate).toBeVisible({ timeout: 15_000 });
  await Promise.all([waitAdPatch(page, String(created.id)), deactivate.click({ timeout: 25_000 })]);

  await expect(card.getByText("Désactivée", { exact: true })).toBeVisible({ timeout: 10_000 });

  const relaunch7 = card
    .getByRole("button", { name: /^7j$/i })
    .or(card.getByRole("link", { name: /^7j$/i }))
    .or(card.getByText(/^7j$/i))
    .first();

  await expect(relaunch7).toBeVisible({ timeout: 15_000 });
  await Promise.all([waitAdPatch(page, String(created.id)), relaunch7.click({ timeout: 25_000 })]);

  await refresh(myAds, page, testInfo);

  await expect(card.getByText("Désactivée", { exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: /^désactiver$/i }).or(card.getByRole("link", { name: /^désactiver$/i }))).toBeVisible({
    timeout: 10_000,
  });

  await expect(card.getByText(title, { exact: false })).toBeVisible({ timeout: 10_000 });
});
