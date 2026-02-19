// e2e/utils/selectors.ts
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { writeDebugFile } from "./dump";

/**
 * Ouvre le panneau "RÉSULTATS" si nécessaire.
 * - ne bloque jamais le test (timeout court)
 * - supporte button/link/texte
 * - écrit un debug file si le contrôle n’existe pas
 */
export async function ensureResultsPanelOpen(page: Page, testInfo?: TestInfo) {
  const resultsTitle = page.getByText(/^RÉSULTATS$/i).first();
  if (await resultsTitle.isVisible().catch(() => false)) return;

  const openList = page
    .getByRole("button", { name: /ouvrir la liste filtrée/i })
    .or(page.getByRole("link", { name: /ouvrir la liste filtrée/i }))
    .or(page.getByText(/ouvrir la liste filtrée/i));

  const hasControl = (await openList.count().catch(() => 0)) > 0;
  if (!hasControl) {
    if (testInfo) await writeDebugFile(testInfo, "results-open-missing.txt", "No control found for 'Ouvrir la liste filtrée'");
    return;
  }

  try {
    await openList.first().scrollIntoViewIfNeeded().catch(() => {});
    await openList.first().click({ timeout: 10_000 });
  } catch (e: any) {
    if (testInfo) await writeDebugFile(testInfo, "results-open-click-error.txt", String(e?.message || e || "click failed"));
    return;
  }

  await expect(resultsTitle).toBeVisible({ timeout: 15_000 });
}

/**
 * Retourne la section "Mes annonces" (ancrée sur le titre).
 */
export async function getMyAdsSection(page: Page) {
  const myAdsTitle = page.getByText("Mes annonces", { exact: true }).first();
  await myAdsTitle.scrollIntoViewIfNeeded().catch(() => {});
  await expect(myAdsTitle).toBeVisible({ timeout: 20_000 });
  return myAdsTitle.locator("xpath=ancestor::section[1]");
}

/**
 * Si la checkbox "Masquer non visibles" est présente et cochée, on la décoche.
 */
export async function ensureNotHidingNonVisible(scope: Locator) {
  const cb = scope.getByRole("checkbox", { name: /masquer non visibles/i }).first();
  if ((await cb.count().catch(() => 0)) === 0) return;

  const checked = await cb.isChecked().catch(() => false);
  if (checked) await cb.click().catch(() => {});
}

/**
 * Locators utilitaires.
 */
export function myAdsCardById(scope: Locator, adId: string | number) {
  return scope.locator(`#ad-${adId}`);
}

export function myAdsCardByTitleFallback(scope: Locator, title: string) {
  return scope.locator("section, article, li, div").filter({ hasText: title }).first();
}
