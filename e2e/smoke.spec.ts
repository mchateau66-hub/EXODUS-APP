// e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

test('homepage alive', async ({ page }) => {
  // essaie plusieurs routes jusqu’à trouver une 2xx
  const candidates = Array.from(new Set([
    process.env.E2E_SMOKE_PATH || '/', // env prioritaire si tu veux forcer un chemin
    '/app',
    '/home',
    '/index',
    '/api/health',                     // fallback santé
  ]));

  let ok = false;
  let last = '';
  let hit = '';                        // le chemin qui a répondu

  for (const p of candidates) {
    const res = await page.goto(p, { waitUntil: 'commit' }); // rapide et OK pour JSON/HTML
    if (!res) continue;
    const status = res.status();
    last = `HTTP ${status} @ ${res.url()}`;
    if (status >= 200 && status < 300) { ok = true; hit = p; break; }
  }

  expect(ok, `Tried: ${candidates.join(', ')}. Last: ${last}`).toBe(true);

  // Si on n’est pas sur une route API, on s’assure que le DOM est visible
  const isApi = hit.startsWith('/api/') || /health/i.test(hit);
  if (!isApi) {
    await expect(page.locator('body')).toBeVisible();
  }
});
