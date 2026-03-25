// e2e/admin-users.spec.ts — filtre plan + facturation sur /admin/users (session admin)
// Prérequis et variables : voir e2e/README-admin-e2e.md (FEATURE_ADMIN_DASHBOARD, ALLOW_DEV_LOGIN, login retries, …).
import { test, expect } from "@playwright/test";
import { BASE_URL, E2E_SMOKE_PATH, login, waitForHealth } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("admin /admin/users — filtres plan & facturation", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(process.env.FEATURE_ADMIN_DASHBOARD === "0", "FEATURE_ADMIN_DASHBOARD=0 désactive l’admin");
    await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? E2E_SMOKE_PATH, 20_000);
    await login(page, { role: "admin", plan: "free", onboardingStep: 3 });
  });

  test("accès admin, filtre forfait visible dans l’URL et le récap", async ({ page }) => {
    await page.goto("/admin/users", { waitUntil: "domcontentloaded", timeout: 25_000 });
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.getByRole("heading", { name: "Utilisateurs" })).toBeVisible();

    await page.locator("#admin-users-plan").selectOption("coach_premium");
    await Promise.all([
      page.waitForURL(/[?&]plan=coach_premium/, { timeout: 25_000 }),
      page.getByRole("button", { name: "Rechercher" }).click(),
    ]);
    await page.waitForLoadState("domcontentloaded");

    // testid préféré ; texte « Filtres actifs » en repli si build/serveur sans le dernier composant admin
    const summary = page
      .getByTestId("admin-users-results-summary")
      .or(page.getByText(/Filtres actifs\s*:/i))
      .first();
    await expect(summary).toBeVisible({ timeout: 20_000 });
    await expect(summary).toContainText(/forfait Stripe/i);
    await expect(summary).toContainText(/Coach premium/i);
  });

  test("combinaison billing=subscribed + plan dans l’URL et le récap", async ({ page }) => {
    await page.goto("/admin/users", { waitUntil: "domcontentloaded", timeout: 25_000 });
    await expect(page).toHaveURL(/\/admin\/users/);

    await page.locator("#admin-users-billing").selectOption("subscribed");
    await page.locator("#admin-users-plan").selectOption("athlete_premium");
    await Promise.all([
      page.waitForURL(
        /(?=.*[?&]billing=subscribed(?:&|$))(?=.*[?&]plan=athlete_premium(?:&|$))/,
        { timeout: 25_000 },
      ),
      page.getByRole("button", { name: "Rechercher" }).click(),
    ]);
    await page.waitForLoadState("domcontentloaded");

    const summary = page
      .getByTestId("admin-users-results-summary")
      .or(page.getByText(/Filtres actifs\s*:/i))
      .first();
    await expect(summary).toBeVisible({ timeout: 20_000 });
    await expect(summary).toContainText(/abonnement Stripe/i);
    await expect(summary).toContainText(/forfait Stripe/i);
    await expect(summary).toContainText(/Athlète premium/i);
  });
});
