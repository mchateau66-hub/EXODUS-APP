// e2e/quota.spec.ts
import { test, expect, type Page } from "@playwright/test";
import {
  BASE_URL,
  waitForHealth,
  login,
  setSessionCookieFromEnv,
  getHeader,
} from "./helpers";

const MESSAGES_PATH = "/api/messages";

// IMPORTANT: ton backend consomme un SAT "one-time" par requête.
// Feature attendue côté backend (par défaut dans notre impl) : "chat.send"
const SAT_FEATURE = (process.env.E2E_SAT_FEATURE?.trim() || "chat.send") as string;

const HAS_SESSION_COOKIE = Boolean(process.env.E2E_SESSION_COOKIE?.trim());
const HAS_SAT_SECRET = Boolean(process.env.SAT_JWT_SECRET?.trim());

const FREE_DAILY_LIMIT = (() => {
  const v =
    process.env.E2E_FREE_DAILY_MESSAGES_LIMIT ??
    process.env.FREE_DAILY_MESSAGES_LIMIT ??
    "20";
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
})();

const MAX_ATTEMPTS = (() => {
  const v = process.env.E2E_QUOTA_MAX_ATTEMPTS ?? "";
  const n = parseInt(v, 10);
  if (Number.isFinite(n) && n > 0) return n;
  // on vise limit+3, cap à 40
  return Math.min(FREE_DAILY_LIMIT + 3, 40);
})();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureAuth(page: Page, plan: "free" | "master" | "premium" = "free") {
  if (HAS_SESSION_COOKIE) return;
  await login(page, { plan });
}

async function acquireSatToken(page: Page): Promise<string | null> {
  if (!HAS_SAT_SECRET) return null;

  // On gère le rate-limit /api/sat: si 429, on attend jusqu'à reset et on retry.
  for (let tries = 0; tries < 10; tries++) {
    const r = await page.request.post("/api/sat", {
      headers: { origin: BASE_URL },
      data: { feature: SAT_FEATURE, method: "POST", path: MESSAGES_PATH },
    });

    if (r.status() === 200) {
      const body = (await r.json().catch(() => ({}))) as any;
      const token = String(body?.token || "");
      if (!token) throw new Error("SAT token missing in /api/sat response");
      return token;
    }

    if (r.status() === 429) {
      // header reset = unix seconds
      const reset = getHeader(r, "ratelimit-reset") ?? getHeader(r, "RateLimit-Reset");
      const resetSec = reset ? Number(reset) : NaN;
      const waitMs =
        Number.isFinite(resetSec) && resetSec > 0
          ? Math.max(0, resetSec * 1000 - Date.now()) + 1100
          : 2000;

      await sleep(Math.min(waitMs, 65_000));
      continue;
    }

    const err = (await r.json().catch(() => ({}))) as any;
    throw new Error(`Unexpected /api/sat status=${r.status()} body=${JSON.stringify(err)}`);
  }

  throw new Error("Unable to acquire SAT token (too many retries)");
}

async function postMessage(page: Page, token: string | null, content: string) {
  const headers: Record<string, string> = {
    origin: BASE_URL,
    "content-type": "application/json",
  };
  if (token) headers["x-sat"] = token;

  // IMPORTANT: on n’envoie PAS coachId => pas de gating coach_verified, pas de pipeline CoachAthlete.
  return page.request.fetch(MESSAGES_PATH, {
    method: "POST",
    headers,
    data: { content },
  });
}

test.describe("Quota free (POST /api/messages)", () => {
  test.beforeAll(async () => {
    await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? "/api/health", 20_000);
  });

  test.beforeEach(async ({ context }) => {
    await setSessionCookieFromEnv(context);
  });

  test(`Free → dépassement quota => 402 quota_exceeded (limit≈${FREE_DAILY_LIMIT})`, async ({
    page,
  }) => {
    await ensureAuth(page, "free");

    let sawQuotaExceeded = false;

    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      const sat = await acquireSatToken(page);

      const res = await postMessage(page, sat, `quota-e2e msg #${i}`);

      if (res.status() === 200) {
        const json = (await res.json().catch(() => ({}))) as any;
        expect(json?.ok).toBe(true);

        // Si le backend renvoie meta.remainingToday, on peut détecter qu'on est proche
        if (json?.meta && typeof json.meta.remainingToday === "number") {
          // no-op: c’est surtout informatif
        }

        continue;
      }

      if (res.status() === 402) {
        const json = (await res.json().catch(() => ({}))) as any;

        // Le bon code d’erreur
        expect(json?.ok).toBe(false);
        expect(json?.error).toBe("quota_exceeded");
        expect(json?.scope).toBe("daily");

        // infos quota
        expect(typeof json?.limit === "number" || json?.limit == null).toBeTruthy();

        // usage/meta présents (selon ton impl)
        if (json?.usage) {
          expect(json.usage.unlimited).toBe(false);
          expect(typeof json.usage.limit).toBe("number");
          expect(typeof json.usage.remaining).toBe("number");
          expect(json.usage.remaining).toBe(0);
        }
        if (json?.meta) {
          expect(json.meta.hasUnlimited).toBe(false);
          expect(typeof json.meta.dailyLimit).toBe("number");
          expect(typeof json.meta.usedToday).toBe("number");
          expect(typeof json.meta.remainingToday).toBe("number");
          expect(json.meta.remainingToday).toBe(0);
        }

        sawQuotaExceeded = true;
        break;
      }

      // Si on tombe sur autre chose, on échoue avec contexte
      const body = (await res.json().catch(() => ({}))) as any;
      throw new Error(
        `Unexpected status=${res.status()} at attempt #${i}. Body=${JSON.stringify(body)}`,
      );
    }

    expect(
      sawQuotaExceeded,
      `Quota non atteint après ${MAX_ATTEMPTS} tentative(s). ` +
        `Si ton FREE_DAILY_MESSAGES_LIMIT est élevé, définis E2E_FREE_DAILY_MESSAGES_LIMIT (ex: 3) pour accélérer, ` +
        `ou augmente E2E_QUOTA_MAX_ATTEMPTS.`,
    ).toBeTruthy();
  });
});
