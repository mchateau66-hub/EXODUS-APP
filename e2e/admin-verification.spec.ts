// e2e/admin-verification.spec.ts — parcours /admin/verification → /admin/users/[id]
// Prérequis seed : voir e2e/README-admin-e2e.md (E2E_SEED_ADMIN_USERS_PAGINATION=1, coach + doc e2e).
import { test, expect } from "@playwright/test";
import { BASE_URL, E2E_SMOKE_PATH, login, waitForHealth } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("admin /admin/verification — verification → fiche utilisateur (seed e2e)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(process.env.FEATURE_ADMIN_DASHBOARD === "0", "FEATURE_ADMIN_DASHBOARD=0 désactive l’admin");
    test.skip(
      process.env.E2E_SEED_ADMIN_USERS_PAGINATION !== "1",
      "E2E_SEED_ADMIN_USERS_PAGINATION=1 requis (pnpm db:seed:e2e:admin — voir e2e/README-admin-e2e.md)",
    );
    await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? E2E_SMOKE_PATH, 20_000);
    await login(page, { role: "admin", plan: "free", onboardingStep: 3 });
  });

  test("recherche slug e2e → lien Voir la fiche admin → Usage et limites", async ({ page }) => {
    await page.goto("/admin/verification", {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });
    await expect(page).toHaveURL(/\/admin\/verification/);
    await expect(page.getByRole("heading", { name: "Vérification coachs" })).toBeVisible();

    await page
      .getByPlaceholder(/Recherche coach \/ slug \/ userId/i)
      .fill("e2e-verification-coach");

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
});
