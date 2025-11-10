// e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

/**
 * Smoke ultra-rapide :
 * - essaie une liste de chemins (dont E2E_SMOKE_PATH si fourni)
 * - valide qu'au moins un renvoie 2xx
 * - si ce n'est pas une route API, vérifie que le DOM est bien visible
 */

const envSmoke = process.env.E2E_SMOKE_PATH?.trim();
const candidates: string[] = Array.from(
  new Set(
    [
      envSmoke && (envSmoke.startsWith('/') ? envSmoke : `/${envSmoke}`),
      '/',            // page d'accueil
      '/home',
      '/index',
      '/api/health',  // fallback santé
      '/api/healthz',
      '/api/status',
    ].filter(Boolean) as string[]
  )
);

const isApiPath = (p: string) => p.startsWith('/api/');

test('@smoke app or health endpoint responds 2xx', async ({ page }, testInfo) => {
  let ok = false;
  let last = '';
  let hit = '';

  for (const p of candidates) {
    try {
      const res = await page.goto(p, { waitUntil: 'commit' }); // rapide et OK pour JSON/HTML
      if (!res) continue;
      const status = res.status();
      last = `HTTP ${status} @ ${res.url()}`;
      if (status >= 200 && status < 300) {
        ok = true;
        hit = p;
        break;
      }
    } catch (err) {
      last = `ERR @ ${p}: ${(err as Error).message}`;
      // on continue sur le prochain candidat
    }
  }

  // Aide au debug dans le report
  testInfo.annotations.push({ type: 'smoke-last', description: last });

  // Au moins un chemin doit répondre 2xx
  expect(ok, `Tried: ${candidates.join(', ')} — Last: ${last}`).toBe(true);

  // Si on n'est pas sur une route API, on vérifie que le DOM est visible
  if (ok && !isApiPath(hit)) {
    await expect(page.locator('body')).toBeVisible();
    await expect.soft(page).toHaveURL(/^(?!about:blank)/);
  }
});
