// e2e/smoke.spec.ts
import { test, expect } from "@playwright/test";

const normalize = (p: string) => (p.startsWith("/") ? p : `/${p}`);

const envSmoke = (process.env.E2E_SMOKE_PATH ?? "").trim();

const apiCandidates = Array.from(
  new Set(
    [
      envSmoke,
      "/api/health/ready",
      "/api/healthz",
      "/api/status",
      "/api/health", // en dernier (souvent protégé)
    ]
      .filter(Boolean)
      .map(normalize),
  ),
);

const pageCandidates = ["/", "/home", "/index"];

test("@smoke app or health endpoint responds 2xx", async ({ page }) => {
  let ok = false;
  let last = "";

  // 1) Essaie des endpoints API “health”
  for (const p of apiCandidates) {
    const r = await page.request.get(p, { timeout: 15_000 }).catch(() => null);
    const status = r?.status() ?? 0;
    last = `API ${p} status=${status}`;
    if (status >= 200 && status < 300) {
      ok = true;
      break;
    }
  }

  // 2) Si aucun health n’est 2xx, on vérifie au moins que la page charge (200-399)
  if (!ok) {
    for (const p of pageCandidates) {
      const r = await page.goto(p, { waitUntil: "domcontentloaded" }).catch(() => null);
      const status = r?.status() ?? 0;
      last = `PAGE ${p} status=${status}`;
      if (status >= 200 && status < 400) {
        ok = true;
        break;
      }
    }
  }

  expect(ok, `Smoke failed. Tried API=${apiCandidates.join(", ")} pages=${pageCandidates.join(", ")} last=${last}`).toBe(true);
  await expect(page.locator("body")).toBeVisible();
});
