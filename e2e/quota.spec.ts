// e2e/quota.spec.ts
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  BASE_URL,
  IS_REMOTE_BASE,
  waitForHealth,
  login,
  setSessionCookieFromEnv,
  acquireSatToken,
  originHeaders,
  headerValue,
} from "./helpers";

const ORIGIN = new URL(BASE_URL).origin;

const MESSAGES_PATH = "/api/messages";
const SAT_FEATURE = (process.env.E2E_SAT_FEATURE?.trim() || "chat.send") as string;

const HAS_SESSION_COOKIE = Boolean(process.env.E2E_SESSION_COOKIE?.trim());
const HAS_SAT_SECRET = Boolean(process.env.SAT_JWT_SECRET?.trim());

const ALLOW_REMOTE = process.env.E2E_ALLOW_REMOTE_QUOTA === "1";

// limite free attendue (pour affichage + borne max)
const FREE_DAILY_LIMIT = (() => {
  const v =
    process.env.E2E_FREE_DAILY_MESSAGES_LIMIT ??
    process.env.FREE_DAILY_MESSAGES_LIMIT ??
    "20";
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
})();

// nombre d’essais max
const MAX_ATTEMPTS = (() => {
  const v = process.env.E2E_QUOTA_MAX_ATTEMPTS ?? "";
  const n = parseInt(v, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return Math.min(FREE_DAILY_LIMIT + 3, 40);
})();

// micro-throttle pour éviter de spammer en CI
const THROTTLE_MS = (() => {
  const v = process.env.E2E_QUOTA_THROTTLE_MS ?? "50";
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 50;
})();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRateLimitResetMsFromHeaders(headers: Record<string, string>) {
  const h =
    headers["ratelimit-reset"] ||
    headers["RateLimit-Reset"] ||
    headers["x-ratelimit-reset"] ||
    headers["X-RateLimit-Reset"];

  if (!h) return null;
  const n = Number(h);
  if (!Number.isFinite(n) || n <= 0) return null;

  // heuristique: epoch seconds
  if (n > 1e9) return n * 1000 - Date.now();
  // sinon delta seconds
  return n * 1000;
}

async function ensureAuth(page: Page, plan: "free" | "master" | "premium" = "free") {
  // Remote: pas de /api/login -> dépend du cookie env.
  if (IS_REMOTE_BASE) return;
  await login(page, { plan });
}

function buildSatPayload() {
  // nonce utile pour anti-replay côté serveur
  return {
    nonce: randomUUID(),
    feature: SAT_FEATURE,
    method: "POST",
    path: MESSAGES_PATH,
  };
}

async function postMessage(page: Page, token: string | null, content: string) {
  const headers: Record<string, string> = {
    ...originHeaders(), // accept/json + content-type + origin/referer + x-e2e
  };
  if (token) headers["x-sat"] = token;

  return page.request.fetch(MESSAGES_PATH, {
    method: "POST",
    headers,
    data: { content },
  });
}

function isSatError(body: any) {
  const e = String(body?.error || "");
  return e.startsWith("sat_");
}

test.describe("Quota free (POST /api/messages)", () => {
  test.beforeAll(async () => {
    await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? "/api/health", 20_000);
  });

  test.beforeEach(async ({ context }) => {
    await setSessionCookieFromEnv(context);
  });

  test(`Free → dépassement quota => 402 quota_exceeded (limit≈${FREE_DAILY_LIMIT})`, async ({ page }) => {
    // Remote: quota partagé => non déterministe
    test.skip(
      IS_REMOTE_BASE && !ALLOW_REMOTE,
      "Quota test is non-deterministic on remote/staging. Set E2E_ALLOW_REMOTE_QUOTA=1 to force.",
    );

    // Si tu forces remote, il faut au moins un cookie
    test.skip(IS_REMOTE_BASE && !HAS_SESSION_COOKIE, "Remote quota requires E2E_SESSION_COOKIE");

    // En local, /api/sat a besoin du secret (selon ton impl)
    test.skip(!IS_REMOTE_BASE && !HAS_SAT_SECRET, "SAT_JWT_SECRET missing for local quota runs");

    test.setTimeout(120_000);

    await ensureAuth(page, "free");

    let sawQuotaExceeded = false;

    // optimisation: dès qu’on voit que SAT est requis, on n’essaie plus “sans SAT”
    let satRequired = false;

    // cache token (si one-shot → il sera invalidé et on réacquerra)
    let satToken: string | null = null;

    // pour debug utile en cas de flake
    const runId = randomUUID().slice(0, 8);

    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      const msg = `quota-e2e(${runId}) #${i}`;

      // 1) call
      let res = await postMessage(page, satRequired ? satToken : null, msg);

      // 2) gère 429 (rare sur /api/messages, mais possible)
      if (res.status() === 429) {
        const hdrs = res.headers();
        const waitMs = parseRateLimitResetMsFromHeaders(hdrs);
        await sleep(Math.min(6000, Math.max(350, waitMs ?? 800)));
        // retry même tentative (sans incrément logique)
        i--;
        continue;
      }

      // 3) SAT required / sat replay / invalid sat => acquire + retry 1 fois
      if (res.status() === 403) {
        const body403 = (await res.json().catch(() => ({}))) as any;
        if (isSatError(body403)) {
          satRequired = true;

          // acquire via helpers (lock + backoff) — payload calé sur ton contrat
          satToken = await acquireSatToken(page, { payload: buildSatPayload() });

          res = await postMessage(page, satToken, msg);
        } else {
          const xi = res.headers()["x-instance"];
          throw new Error(
            `Unexpected 403 (not SAT). x-instance=${xi || "n/a"} body=${JSON.stringify(body403)}`,
          );
        }
      }

      // 4) succès -> continue
      if (res.status() === 200) {
        const json = (await res.json().catch(() => ({}))) as any;
        expect(json?.ok).toBe(true);

        // si token one-shot, la requête suivante pourra échouer => on conserve, mais on sait réacquérir
        // (si tu veux réduire /api/sat, laisse satToken en cache)
        await sleep(THROTTLE_MS);
        continue;
      }

      // 5) quota atteint
      if (res.status() === 402) {
        const json = (await res.json().catch(() => ({}))) as any;

        expect(json?.ok).toBe(false);
        expect(json?.error).toBe("quota_exceeded");
        expect(json?.scope).toBe("daily");

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

      // 6) autres statuts -> erreur debug
      const xi = res.headers()["x-instance"];
      const body = (await res.json().catch(() => ({}))) as any;

      // si 401 en remote, typiquement cookie manquant / expiré
      if (res.status() === 401) {
        throw new Error(
          `Unauthorized (401). base=${BASE_URL} x-instance=${xi || "n/a"} ` +
            `Likely: session cookie missing/expired or same-origin policy failed. body=${JSON.stringify(body)}`
        );
      }

      // si 400/415 etc -> problème headers/payload
      const maybeOrigin = headerValue(res, "x-origin-check") || "";
      throw new Error(
        `Unexpected status=${res.status()} at attempt #${i}. base=${BASE_URL} origin=${ORIGIN} x-instance=${xi || "n/a"} ` +
          `${maybeOrigin ? `x-origin-check=${maybeOrigin} ` : ""}` +
          `Body=${JSON.stringify(body)}`
      );
    }

    expect(
      sawQuotaExceeded,
      `Quota non atteint après ${MAX_ATTEMPTS} tentative(s). ` +
        `Astuce: définis E2E_FREE_DAILY_MESSAGES_LIMIT (ex: 3) ou augmente E2E_QUOTA_MAX_ATTEMPTS.`,
    ).toBeTruthy();
  });
});
