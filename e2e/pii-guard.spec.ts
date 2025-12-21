// e2e/pii-guard.spec.ts
import { test, expect, type Page } from '@playwright/test';
import {
  BASE_URL,
  waitForHealth,
  login,
  gotoOk,
  setSessionCookieFromEnv,
} from './helpers';

const HAS_SESSION_COOKIE = Boolean(process.env.E2E_SESSION_COOKIE?.trim());

async function ensureAuth(page: Page, plan: 'free' | 'master' | 'premium' = 'free') {
  // En CI/staging, si cookie injecté via env, on évite /api/login.
  if (HAS_SESSION_COOKIE) return;
  await login(page, { plan });
}

// Email classique
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
// Tel FR simple +33/0
const PHONE_RE = /(\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}\b/i;

test.describe('PII-Guard (client)', () => {
  test.beforeAll(async () => {
    await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? '/api/health', 20_000);
  });

  test.beforeEach(async ({ context }) => {
    await setSessionCookieFromEnv(context);
  });

  test("Free → le payload sortant ne doit pas contenir d'email/tel en clair", async ({ page }) => {
    await ensureAuth(page, 'free');

    await gotoOk(page, '/messages', { waitUntil: 'domcontentloaded', allowRedirects: true });

    // Interception: on inspecte le body sortant
    await page.route('**/api/messages', async (route) => {
      const req = route.request();
      const raw = req.postData() || '';

      // Check brut (au cas où)
      expect(raw).not.toMatch(EMAIL_RE);
      expect(raw).not.toMatch(PHONE_RE);

      // Check ciblé sur content si JSON
      try {
        const parsed = JSON.parse(raw) as any;
        const content = typeof parsed?.content === 'string' ? parsed.content : '';
        expect(content).not.toMatch(EMAIL_RE);
        expect(content).not.toMatch(PHONE_RE);
      } catch {
        // pas JSON => déjà couvert par le check brut
      }

      // Réponse réaliste (évite un crash UI si le front attend "message")
      const nowIso = new Date().toISOString();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          message: {
            id: 'e2e-msg',
            user_id: 'e2e-user',
            coach_id: null,
            content: '[masked]',
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

    // Champ de saisie
    const input = page.locator('textarea, [contenteditable="true"], input[type="text"]').first();
    await expect(input).toBeVisible();

    await input.fill('Mon mail: test@example.com et mon tel: 06 12 34 56 78');

    const sendBtn = page.getByRole('button', { name: /envoyer|send/i }).first();
    await expect(sendBtn).toBeVisible();
    await sendBtn.click();

    // Optionnel: beaucoup d’UI vident le champ après envoi
    await expect.soft(input).toHaveValue('');
  });
});
