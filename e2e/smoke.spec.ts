import { test, expect } from "@playwright/test";

// Par défaut on essaie l'env (défini / éventuellement ajusté par global-setup),
// sinon fallback.
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

test("@smoke app or health endpoint responds 2xx and homepage loads", async ({ page, request }) => {
  let ok = false;
  let last = "";

  // 1) Health/API: 2xx obligatoire
  for (const p of apiCandidates) {
    const r = await request.get(p, { timeout: 15_000 }).catch(() => null);
    const status = r?.status() ?? 0;
    last = `API ${p} status=${status}`;
    if (status >= 200 && status < 300) {
      ok = true;
      break;
    }
  }

  expect(ok, `Health failed. Tried=${apiCandidates.join(", ")} last=${last}`).toBe(true);

  // 2) Homepage: charge + DOM visible (3xx ok si redirect)
  const res = await page.goto("/", { waitUntil: "domcontentloaded", timeout: 20_000 });
  expect(res, "homepage navigation returned null response").toBeTruthy();

  const st = res!.status();
  expect(st, `homepage status should be < 400, got ${st}`).toBeLessThan(400);

  await expect(page.locator("body")).toBeVisible();
});
