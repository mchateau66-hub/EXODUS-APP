import { test, expect } from "@playwright/test";

// Par défaut on essaie /api/health/ready (public), sinon fallback
const envPath = (process.env.E2E_SMOKE_PATH || "").trim();
const preferred = envPath || "/api/health/ready";

const apiCandidates = Array.from(
  new Set([
    preferred,
    "/api/health/ready",
    "/api/health",
    "/api/healthz",
    "/api/status",
  ]),
).map((p) => (p.startsWith("/") ? p : `/${p}`));

const pageCandidates = ["/", "/home", "/index"];

test("@smoke app or health endpoint responds 2xx and homepage loads", async ({ page }) => {
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

  const res = await page.goto(pageCandidates[0]!, { waitUntil: "domcontentloaded" });
  expect(res, "homepage navigation returned null response").toBeTruthy();
  await expect(page.locator("body")).toBeVisible();
});
