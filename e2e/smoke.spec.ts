// e2e/smoke.spec.ts
import { test, expect } from "@playwright/test";

const smokePath = (process.env.E2E_SMOKE_PATH || "/api/health").trim();
const apiCandidates = Array.from(new Set([smokePath, "/api/health"])).map((p) =>
  p.startsWith("/") ? p : `/${p}`,
);

const pageCandidates = ["/", "/home", "/index"];

test("@smoke health responds (2xx) and homepage loads", async ({ page }) => {
  // 1) Health (API)
  let ok = false;
  let last = "";

  for (const p of apiCandidates) {
    const r = await page.request.get(p, { timeout: 15_000 }).catch(() => null);
    const status = r?.status() ?? 0;
    last = `API ${p} status=${status}`;
    if (status >= 200 && status < 300) {
      ok = true;
      break;
    }
  }

  expect(ok, `Health failed. Tried=${apiCandidates.join(", ")} last=${last}`).toBe(true);

  // 2) Page (soft)
  const res = await page.goto(pageCandidates[0]!, { waitUntil: "domcontentloaded" });
  expect(res, "homepage navigation returned null response").toBeTruthy();
  await expect(page.locator("body")).toBeVisible();
});
