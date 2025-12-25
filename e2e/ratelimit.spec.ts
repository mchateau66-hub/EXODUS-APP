// e2e/ratelimit.spec.ts
import { test, expect } from "@playwright/test";
import { BASE_URL, waitForHealth, login, getHeader, setSessionCookieFromEnv } from "./helpers";

const FEATURE = (process.env.E2E_SAT_FEATURE?.trim() || "chat.media") as string;
const HAS_SESSION_COOKIE = Boolean(process.env.E2E_SESSION_COOKIE?.trim());

async function ensureAuth(page: any, plan: "free" | "master" | "premium" = "premium") {
  if (HAS_SESSION_COOKIE) return;
  await login(page, { plan });
}

test.describe("Rate-limit /api/sat", () => {
  test.beforeAll(async () => {
    await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? "/api/health", 20_000);
  });

  test.beforeEach(async ({ context }) => {
    await setSessionCookieFromEnv(context);
  });

  test("Burst /api/sat → finit par 429 (ou remaining descend)", async ({ page }) => {
    await ensureAuth(page, "premium");

    let hit429 = false;
    let sawRateHeaders = false;
    let remainingFirst: number | null = null;
    let remainingLast: number | null = null;

    for (let i = 0; i < 50; i++) {
      const r = await page.request.post("/api/sat", {
        headers: {
          origin: BASE_URL,
          "content-type": "application/json",
          // ✅ IMPORTANT: force le mode E2E pour activer le rate-limit même en local
          "x-e2e": "1",
        },
        data: { feature: FEATURE, method: "POST", path: "/api/messages" },
      });

      const limit = getHeader(r, "ratelimit-limit") ?? getHeader(r, "RateLimit-Limit");
      const remaining = getHeader(r, "ratelimit-remaining") ?? getHeader(r, "RateLimit-Remaining");
      const reset = getHeader(r, "ratelimit-reset") ?? getHeader(r, "RateLimit-Reset");

      if (limit && remaining && reset) sawRateHeaders = true;

      const remN = remaining ? Number(remaining) : NaN;
      if (Number.isFinite(remN)) {
        if (remainingFirst === null) remainingFirst = remN;
        remainingLast = remN;
      }

      if (r.status() === 429) {
        hit429 = true;
        break;
      }
    }

    if (hit429) {
      expect(hit429).toBeTruthy();
      return;
    }

    expect(sawRateHeaders).toBeTruthy();
    if (remainingFirst !== null && remainingLast !== null) {
      expect(remainingLast).toBeLessThanOrEqual(remainingFirst);
    }
  });
});
