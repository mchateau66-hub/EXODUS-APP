// e2e/pii-guard.spec.ts
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  BASE_URL,
  IS_REMOTE_BASE,
  waitForHealth,
  login,
  gotoOk,
  setSessionCookieFromEnv,
} from "./helpers";

// Email classique
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
// Tel FR simple +33/0
const PHONE_RE = /(\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}\b/i;

async function setPlanCookie(context: any, plan: "free" | "master" | "premium") {
  const u = new URL(BASE_URL);
  const secure = u.protocol === "https:";
  await context.addCookies([
    {
      name: "plan",
      value: plan,
      url: u.origin, // host-only friendly
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
      secure,
    },
  ]);
}

/**
 * IMPORTANT:
 * - Local: login backdoor possible => email unique par run pour éviter quota/état.
 * - Remote: backdoor /api/login désactivé => on s'appuie sur E2E_SESSION_COOKIE (si présent),
 *   et on force le cookie "plan=free" pour que le front se comporte comme Free.
 */
async function ensureAuthForPii(page: Page, plan: "free" | "master" | "premium" = "free") {
  if (IS_REMOTE_BASE) {
    await setPlanCookie(page.context(), plan);
    return;
  }

  await login(page, {
    plan,
    email: `e2e+pii-${randomUUID()}@exodus.local`,
  });
}

function extractLikelyContent(parsed: any): string {
  if (!parsed || typeof parsed !== "object") return "";
  const fields = ["content", "text", "message", "prompt", "input"];
  for (const k of fields) {
    const v = (parsed as any)[k];
    if (typeof v === "string") return v;
  }
  return "";
}

test.describe("PII-Guard (client)", () => {
  test.beforeAll(async () => {
    await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? "/api/health", 20_000);
  });

  test.beforeEach(async ({ context }) => {
    await setSessionCookieFromEnv(context);
  });

  test("Free → le payload sortant ne doit pas contenir d'email/tel en clair", async ({ page }) => {
    await ensureAuthForPii(page, "free");

    await page.route("**/api/messages", async (route) => {
      const req = route.request();
      const raw = req.postData() || "";

      // Check brut
      expect(raw).not.toMatch(EMAIL_RE);
      expect(raw).not.toMatch(PHONE_RE);

      // Check ciblé JSON
      try {
        const parsed = JSON.parse(raw) as any;
        const content = extractLikelyContent(parsed);
        expect(content).not.toMatch(EMAIL_RE);
        expect(content).not.toMatch(PHONE_RE);
      } catch {
        // non-JSON => déjà couvert
      }

      const nowIso = new Date().toISOString();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          message: {
            id: "e2e-msg",
            user_id: "e2e-user",
            coach_id: null,
            content: "[masked]",
            created_at: nowIso,
          },
          usage: { unlimited: false, limit: 20, remaining: 19 },
          meta: {
            hasUnlimited: false,
            dailyLimit: 20,
            usedToday: 1,
            remainingToday: 19,
          },
        }),
      });
    });

    await gotoOk(page, "/messages", { waitUntil: "domcontentloaded", allowRedirects: true });

    const input = page.locator("textarea, [contenteditable='true'], input[type='text']").first();
    await expect(input).toBeVisible();

    await input.click();
    await input.type("Mon mail: test@example.com et mon tel: 06 12 34 56 78", { delay: 5 });

    const sendBtn = page.getByRole("button", { name: /envoyer|send/i }).first();
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeEnabled({ timeout: 10_000 });

    await sendBtn.click();

    await expect.soft(input).toHaveValue("");
  });
});
