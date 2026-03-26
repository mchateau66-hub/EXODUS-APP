// e2e/admin-verification.spec.ts — /admin/verification (navigation, modération approve/reject)
// Prérequis seed : voir e2e/README-admin-e2e.md (E2E_SEED_ADMIN_USERS_PAGINATION=1).
import { test, expect } from "@playwright/test";
import { BASE_URL } from "./helpers";
import {
  approveDoc,
  expandAllVerificationGroups,
  loginAdmin,
  rejectDoc,
  searchVerification,
} from "./admin-verification-helpers";
import {
  E2E_VERIFICATION_DOCUMENT_ID_APPROVE,
  E2E_VERIFICATION_DOCUMENT_ID_REJECT,
} from "./fixtures/e2e-admin-verification-ids";

test.describe.configure({ mode: "serial" });

test.describe("admin /admin/verification — verification → fiche utilisateur (seed e2e)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(process.env.FEATURE_ADMIN_DASHBOARD === "0", "FEATURE_ADMIN_DASHBOARD=0 désactive l’admin");
    test.skip(
      process.env.E2E_SEED_ADMIN_USERS_PAGINATION !== "1",
      "E2E_SEED_ADMIN_USERS_PAGINATION=1 requis (pnpm db:seed:e2e:admin — voir e2e/README-admin-e2e.md)",
    );
    await loginAdmin(page);
  });

  test("recherche slug e2e → lien Voir la fiche admin → Usage et limites", async ({ page }) => {
    await searchVerification(page, "e2e-verification-coach");

    await expect(
      page.getByRole("link", { name: "Voir la fiche admin" }).first(),
    ).toBeVisible({ timeout: 20_000 });

    await Promise.all([
      page.waitForURL(/\/admin\/users\/[0-9a-f-]{36}/),
      page.getByRole("link", { name: "Voir la fiche admin" }).first().click(),
    ]);
    await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}/);

    await expect(page.getByRole("heading", { name: "Usage et limites" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Profil" })).toBeVisible();
  });

  test("Approuver doc pending → UI verified, persistance après reload", async ({ page }) => {
    await searchVerification(page, "e2e-verification-coach");
    await expandAllVerificationGroups(page);

    const statusLoc = page.getByTestId(`verification-status-${E2E_VERIFICATION_DOCUMENT_ID_APPROVE}`);
    await expect(statusLoc).toContainText(/pending/i, { timeout: 15_000 });

    await approveDoc(page, E2E_VERIFICATION_DOCUMENT_ID_APPROVE);
    await expect(statusLoc).toContainText(/verified/i, { timeout: 15_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByPlaceholder(/Recherche coach \/ slug \/ userId/i).fill("e2e-verification-coach");
    await expandAllVerificationGroups(page);
    await expect(page.getByTestId(`verification-status-${E2E_VERIFICATION_DOCUMENT_ID_APPROVE}`)).toContainText(
      /verified/i,
      { timeout: 15_000 },
    );
  });

  test("Rejeter doc pending → UI rejected, persistance après reload", async ({ page }) => {
    await searchVerification(page, "e2e-verification-coach-reject");
    await expandAllVerificationGroups(page);

    const statusLoc = page.getByTestId(`verification-status-${E2E_VERIFICATION_DOCUMENT_ID_REJECT}`);
    await expect(statusLoc).toContainText(/pending/i, { timeout: 15_000 });

    await rejectDoc(page, E2E_VERIFICATION_DOCUMENT_ID_REJECT);
    await expect(statusLoc).toContainText(/rejected/i, { timeout: 15_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByPlaceholder(/Recherche coach \/ slug \/ userId/i).fill("e2e-verification-coach-reject");
    await expandAllVerificationGroups(page);
    await expect(page.getByTestId(`verification-status-${E2E_VERIFICATION_DOCUMENT_ID_REJECT}`)).toContainText(
      /rejected/i,
      { timeout: 15_000 },
    );
  });

  test("API : second approve sur doc déjà vérifié → 409", async ({ page }) => {
    const res = await page.request.post(
      `${BASE_URL.replace(/\/$/, "")}/api/admin/verification/${E2E_VERIFICATION_DOCUMENT_ID_APPROVE}/approve`,
      { data: {} },
    );
    expect(res.status()).toBe(409);
    const j = (await res.json()) as { success?: boolean; error?: string };
    expect(j.success).toBe(false);
    expect(j.error).toBe("invalid_state");
  });

  test("API : approve sans session → 401", async ({ request }) => {
    const res = await request.post(
      `${BASE_URL.replace(/\/$/, "")}/api/admin/verification/${E2E_VERIFICATION_DOCUMENT_ID_APPROVE}/approve`,
      {
        data: {},
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(res.status()).toBe(401);
  });

  test("API : document inexistant → 404", async ({ page }) => {
    const missingId = "00000000-0000-4000-8000-000000000099";
    const res = await page.request.post(
      `${BASE_URL.replace(/\/$/, "")}/api/admin/verification/${missingId}/approve`,
      { data: {} },
    );
    expect(res.status()).toBe(404);
  });
});
