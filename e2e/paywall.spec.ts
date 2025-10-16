// e2e/paywall.spec.ts
import { test, expect } from '@playwright/test';
import { isPaywallVisible } from './helpers';

const PATH   = process.env.E2E_PAYWALL_PATH ?? '/pro';
const SEL    = process.env.E2E_PAYWALL_SELECTOR;      // ex: [data-test="paywall"]
const OK_SEL = process.env.E2E_PAYWALL_OK_SELECTOR;   // ex: main,[data-test="content"]

// Par défaut, on TRAITE 404 COMME BLOQUÉ (désactive avec E2E_PAYWALL_ALLOW_404_AS_BLOCKED=0)
const allow404 = (process.env.E2E_PAYWALL_ALLOW_404_AS_BLOCKED ?? '1') === '1';

test('paywall ▸ anonyme → contenu protégé bloqué', async ({ browser, context }) => {
  const anon = await (context ?? (await browser.newContext())).newPage();

  const res  = await anon.goto(PATH, { waitUntil: 'domcontentloaded' });
  const st   = res?.status() ?? 0;
  const loc  = res?.headers()['location'] ?? '';
  const url  = res?.url() ?? '';

  // 1) blocage par status HTTP
  const blockedByStatus = new Set<number>([401, 402, 403, ...(allow404 ? [404] : [])]).has(st);

  // 2) redirection vers login / auth / subscribe / paywall
  const redirectedToAuth =
    [301,302,303,307,308].includes(st) &&
    /(login|signin|auth|subscribe|checkout|paywall)/i.test(loc || url);

  // 3) UI de paywall visible (si tu fournis un sélecteur)
  const blockedByUI = await isPaywallVisible(anon, SEL);

  // 4) Option “OK selector” (si la page de contenu s’affiche quand autorisé)
  const okSelectorVisible = OK_SEL
    ? await anon.locator(OK_SEL).first().isVisible().catch(() => false)
    : false;

  // Verdict : bloqué si l’un des trois signaux est vrai, et PAS okSelectorVisible
  const blocked =
    (blockedByStatus || redirectedToAuth || blockedByUI) && !okSelectorVisible;

  expect(
    blocked,
    `status=${st} location=${loc} url=${url} paywallUI=${blockedByUI} okSel=${okSelectorVisible}`
  ).toBe(true);

  await anon.context().close().catch(() => {});
});
