import type { Page } from "@playwright/test";
import { BASE_URL, E2E_SMOKE_PATH, login, waitForHealth } from "./helpers";

export async function loginAdmin(page: Page) {
  await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? E2E_SMOKE_PATH, 20_000);
  await login(page, { role: "admin", plan: "free", onboardingStep: 3 });
}

/** Session athlète ou coach (tests 403 sur routes admin verification). */
export async function loginNonAdmin(page: Page, role: "athlete" | "coach" = "athlete") {
  await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? E2E_SMOKE_PATH, 20_000);
  await login(page, { role, plan: "free", onboardingStep: 3 });
}

export async function searchVerification(page: Page, slug: string) {
  await page.goto("/admin/verification", {
    waitUntil: "domcontentloaded",
    timeout: 25_000,
  });
  await page.getByPlaceholder(/Recherche coach \/ slug \/ userId/i).fill(slug);
}

export async function expandAllVerificationGroups(page: Page) {
  await page.getByRole("button", { name: "Expand all" }).click();
}

export async function approveDoc(page: Page, docId: string) {
  await page.getByTestId(`approve-doc-${docId}`).click();
}

export async function rejectDoc(page: Page, docId: string) {
  await page.getByTestId(`reject-doc-${docId}`).click();
}
