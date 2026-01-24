// e2e/diag-hub.spec.ts
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { login, originHeaders, waitForHealth } from "./helpers";

test("diag: hub render + click Offres + dump testids/logs", async ({ page }, testInfo) => {
  test.setTimeout(60_000);

  // --- Collectors
  const consoleLogs: string[] = [];
  const pageErrors: string[] = [];
  const reqFailed: string[] = [];
  const apiTraffic: Array<{ method: string; url: string; status?: number; note?: string }> = [];

  page.on("crash", () => consoleLogs.push("[PAGE] crash"));
  page.on("close", () => consoleLogs.push("[PAGE] close"));

  page.on("pageerror", (e) => {
    const msg = e?.message || String(e);
    pageErrors.push(msg);
  });

  page.on("console", (m) => {
    const line = `[console.${m.type()}] ${m.text()}`;
    consoleLogs.push(line);
  });

  page.on("requestfailed", (r) => {
    const line = `[requestfailed] ${r.method()} ${r.url()} :: ${r.failure()?.errorText || "unknown"}`;
    reqFailed.push(line);
  });

  page.on("response", (r) => {
    const url = r.url();
    if (url.includes("/api/")) {
      apiTraffic.push({ method: r.request().method(), url, status: r.status() });
    } else if (r.status() >= 400) {
      apiTraffic.push({ method: r.request().method(), url, status: r.status(), note: "non-api>=400" });
    }
  });

  // 0) App up
  await waitForHealth();

  // 1) Session clean
  await page.context().clearCookies();
  await page.addInitScript(() => {
    try {
      window.localStorage?.clear();
      window.sessionStorage?.clear();
    } catch {}
  });

  // 2) Login
  const email = (process.env.E2E_TEST_EMAIL ?? `e2e+${randomUUID()}@exodus.local`).toLowerCase();
  const loginRes = await login(page, { email, plan: "free", role: "athlete" });

  const loginText = await loginRes.text().catch(() => "");
  testInfo.attach("diag-login", {
    body: JSON.stringify(
      {
        url: loginRes.url(),
        status: loginRes.status(),
        ok: loginRes.ok(),
        headers: loginRes.headers(),
        body: loginText,
      },
      null,
      2
    ),
    contentType: "application/json",
  });

  expect(loginRes.ok(), `login failed: ${loginRes.status()} ${loginText}`).toBeTruthy();

  // cookies after login
  const cookiesAfter = await page.context().cookies();
  testInfo.attach("diag-cookies-after-login", {
    body: JSON.stringify(
      cookiesAfter.map((c) => ({ name: c.name, value: c.value?.slice(0, 8) + "...", domain: c.domain, path: c.path })),
      null,
      2
    ),
    contentType: "application/json",
  });

  // 3) Onboarding status
  const statusRes = await page.request.get("/api/onboarding/status", { headers: originHeaders() });
  const statusText = await statusRes.text().catch(() => "");
  testInfo.attach("diag-onboarding-status", {
    body: JSON.stringify(
      { url: statusRes.url(), status: statusRes.status(), ok: statusRes.ok(), body: statusText },
      null,
      2
    ),
    contentType: "application/json",
  });
  expect(statusRes.ok(), `GET /api/onboarding/status failed: ${statusRes.status()} ${statusText}`).toBeTruthy();

  // 4) Go /hub
  const res = await page.goto("/hub", { waitUntil: "domcontentloaded" });
  testInfo.attach("diag-hub-response", {
    body: JSON.stringify({ ok: !!res, status: res?.status?.() }, null, 2),
    contentType: "application/json",
  });

  // 5) Clique Offres/Offers (sinon tu restes sur Carte des coachs)
  const offres = page
    .locator('button,a,[role="tab"]')
    .filter({ hasText: /offres|offers/i })
    .first();

  await expect(offres, "Offres/Offers tab/button not found on /hub").toBeVisible({ timeout: 20_000 });
  await offres.click();

  // stabilise (Next/app router)
  await page.waitForLoadState("networkidle").catch(() => {});

  // 6) Dump testids + html + body text + screenshot
  const testids = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-testid]"))
      .map((el) => el.getAttribute("data-testid"))
      .filter(Boolean)
  );

  const html = await page.content().catch(() => "");
  const bodyText = await page.evaluate(() => (document.body?.innerText || "").slice(0, 4000)).catch(() => "");

  testInfo.attach("diag-testids", { body: testids.join(", "), contentType: "text/plain" });
  testInfo.attach("diag-hub-html", { body: html.slice(0, 200_000), contentType: "text/html" });
  testInfo.attach("diag-body-text", { body: bodyText, contentType: "text/plain" });
  testInfo.attach("diag-hub-screenshot", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });

  // logs
  testInfo.attach("diag-console", {
    body: consoleLogs.join("\n").slice(0, 200_000),
    contentType: "text/plain",
  });
  testInfo.attach("diag-page-errors", {
    body: pageErrors.join("\n\n").slice(0, 200_000),
    contentType: "text/plain",
  });
  testInfo.attach("diag-request-failed", {
    body: reqFailed.join("\n").slice(0, 200_000),
    contentType: "text/plain",
  });
  testInfo.attach("diag-api-traffic", {
    body: JSON.stringify(apiTraffic, null, 2).slice(0, 200_000),
    contentType: "application/json",
  });

  // 7) Assertion informative : myads doit exister après Offres
  const hasMyads = testids.includes("myads");
  if (!hasMyads) {
    throw new Error(
      `diag: /hub loaded + clicked Offres, but data-testid="myads" NOT found.\n` +
        `finalUrl=${page.url()}\n` +
        `testids(${testids.length})=${testids.join(", ")}`
    );
  }

  // Si présent, on valide qu'il est visible
  await expect(page.getByTestId("myads")).toBeVisible({ timeout: 20_000 });
});
