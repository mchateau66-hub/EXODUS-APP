// e2e/hub-map.spec.ts
import { test, expect, type Request } from "@playwright/test";
import { login, setPlanCookie } from "./helpers";
import { stubLeafletTiles } from "./utils/leaflet";
import { ensureOutputDir, writeDebugFile, readDebugFile, dump } from "./utils/dump";
import { ensureResultsPanelOpen } from "./utils/selectors";

function isHubAdsCall(req: Request) {
  const m = req.method();
  if (m !== "GET" && m !== "POST") return false;

  try {
    const u = new URL(req.url());
    return u.pathname.includes("/api/hub/ads");
  } catch {
    return req.url().includes("/api/hub/ads");
  }
}

async function tryTriggerHubAds(page: any, action: () => Promise<void>, timeoutMs = 8_000) {
  const reqP = page.waitForRequest(isHubAdsCall, { timeout: timeoutMs }).catch(() => null);
  await action();
  const req = await reqP;
  if (!req) return null;

  const res = await page.waitForResponse((r: any) => r.request() === req, { timeout: timeoutMs }).catch(() => null);
  return { req, res };
}

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    const netLog = await readDebugFile(testInfo, "netlog.txt");
    await dump(page, testInfo, "failed", { netLog });
  }
});

test("hub: map (smoke) — /hub + map visible + (si actif) interaction déclenche /api/hub/ads", async ({ page }, testInfo) => {
  test.setTimeout(90_000);

  const strictHubAds = (process.env.E2E_STRICT_HUB_ADS ?? "").trim() === "1";

  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {}
    try {
      sessionStorage.clear();
    } catch {}
  });

  await stubLeafletTiles(page);
  await ensureOutputDir(testInfo);

  const netLines: string[] = [];
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("/api/") || u.includes("/hub")) netLines.push(`REQ ${req.method()} ${u}`);
  });
  page.on("response", (res) => {
    const u = res.url();
    if (u.includes("/api/") || u.includes("/hub")) netLines.push(`RES ${res.status()} ${u}`);
  });

  await login(page, { role: "athlete", plan: "premium", onboardingStep: 3 });
  await setPlanCookie(page.context(), "premium");

  await page.goto("/hub", { waitUntil: "domcontentloaded", timeout: 60_000 });

  const map = page.locator(".leaflet-container");
  await expect(map).toBeVisible({ timeout: 20_000 });

  await ensureResultsPanelOpen(page, testInfo);
  await expect(page.getByText(/résultats/i)).toBeVisible({ timeout: 15_000 });

  const zoomIn = page.locator(".leaflet-control-zoom-in");
  let hit: any = null;

  if ((await zoomIn.count().catch(() => 0)) > 0) {
    hit = await tryTriggerHubAds(
      page,
      async () => {
        await zoomIn.first().click({ timeout: 10_000 });
      },
      8_000
    );
  }

  if (!hit) {
    hit = await tryTriggerHubAds(
      page,
      async () => {
        const box = await map.boundingBox();
        if (!box) throw new Error("leaflet-container has no bounding box");

        await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.55, { steps: 12 });
        await page.mouse.up();
      },
      8_000
    );
  }

  await writeDebugFile(testInfo, "netlog.txt", netLines.join("\n"));

  if (hit?.res) {
    const status = hit.res.status();
    expect(status, `hub/ads returned ${status} (${hit.res.url()})`).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(400);
    return;
  }

  if (strictHubAds) {
    await dump(page, testInfo, "no-hub-ads-call", { netLog: netLines.join("\n") });
    throw new Error("Strict mode: no /api/hub/ads request observed after zoom/drag.");
  }

  await writeDebugFile(testInfo, "step-no-hub-ads-call.txt", "No /api/hub/ads call observed (non-strict mode)");
});
