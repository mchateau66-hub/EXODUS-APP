// e2e/admin-users.spec.ts — filtres /admin/users (plan, facturation, premium/entitlements, SSR)
// Le filtre « Offre premium » (query `premium`) porte sur les entitlements actifs, pas sur le forfait Stripe (`plan` / `billing`).
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

  test("filtre premium=with : URL et récap (entitlements)", async ({ page }) => {
    await page.goto("/admin/users", { waitUntil: "domcontentloaded", timeout: 25_000 });
    await expect(page).toHaveURL(/\/admin\/users/);

    await page.locator("#admin-users-premium").selectOption("with");
    await Promise.all([
      page.waitForURL(/[?&]premium=with(?:&|$)/, { timeout: 25_000 }),
      page.getByRole("button", { name: "Rechercher" }).click(),
    ]);
    await page.waitForLoadState("domcontentloaded");

    const summary = page
      .getByTestId("admin-users-results-summary")
      .or(page.getByText(/Filtres actifs\s*:/i))
      .first();
    await expect(summary).toBeVisible({ timeout: 20_000 });
    // Aligné sur ADMIN_USER_PREMIUM_FILTER_SUMMARY_LABELS (config admin users)
    await expect(summary).toContainText(/droits premium actifs/i);
  });

  test("recherche sans résultat : message explicite et récap filtres (SSR)", async ({ page }) => {
    const token = "zze2e-admin-no-results-impossible-token";
    await page.goto(
      `/admin/users?q=${encodeURIComponent(token)}&plan=coach_premium`,
      { waitUntil: "domcontentloaded", timeout: 25_000 },
    );
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.getByText(/Aucun utilisateur ne correspond/i)).toBeVisible();
    const summary = page
      .getByTestId("admin-users-results-summary")
      .or(page.getByText(/Filtres actifs\s*:/i))
      .first();
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(/forfait Stripe/i);
  });

  test("pagination : page hors plage redirigée (0 résultat, URL canonique)", async ({ page }) => {
    const token = "zze2e-admin-no-results-impossible-token";
    await page.goto(
      `/admin/users?q=${encodeURIComponent(token)}&plan=coach_premium&page=999`,
      { waitUntil: "domcontentloaded", timeout: 25_000 },
    );
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page).not.toHaveURL(/[?&]page=999/);
    await expect(page).toHaveURL(/[?&]plan=coach_premium/);
    await expect(page.getByText(/Aucun utilisateur ne correspond/i)).toBeVisible();
  });

  test("pagination : sans critères de recherche, page dans l’URL est ignorée (redirect)", async ({
    page,
  }) => {
    await page.goto("/admin/users?page=2", { waitUntil: "domcontentloaded", timeout: 25_000 });
    await expect(page).toHaveURL((url) => {
      const u = new URL(url);
      return u.pathname === "/admin/users" && u.search === "";
    });
  });
});

test.describe("admin /admin/users — pagination multi-page (seed e2e)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(process.env.FEATURE_ADMIN_DASHBOARD === "0", "FEATURE_ADMIN_DASHBOARD=0 désactive l’admin");
    test.skip(
      process.env.E2E_SEED_ADMIN_USERS_PAGINATION !== "1",
      "E2E_SEED_ADMIN_USERS_PAGINATION=1 requis (pnpm db:seed avec ce flag + voir e2e/README-admin-e2e.md)",
    );
    await waitForHealth(BASE_URL, process.env.E2E_SMOKE_PATH ?? E2E_SMOKE_PATH, 20_000);
    await login(page, { role: "admin", plan: "free", onboardingStep: 3 });
  });

  test("navigation page 1 → page 2 (filtres + compteur + pagination)", async ({ page }) => {
    const qs = new URLSearchParams({ q: "e2e-pagination", role: "athlete" });
    await page.goto(`/admin/users?${qs.toString()}`, {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });
    await expect(page).toHaveURL(/\/admin\/users/);

    const pagination = page.getByTestId("admin-users-results-pagination");
    await expect(pagination).toBeVisible({ timeout: 20_000 });
    await expect(pagination).toContainText(/Page 1 \/ 2/);

    const countLine = page.getByTestId("admin-users-results-count");
    await expect(countLine).toContainText(/1–20 sur 22/);

    await Promise.all([
      page.waitForURL(/[?&]page=2(?:&|$)/, { timeout: 25_000 }),
      page.getByRole("link", { name: "Suivant" }).click(),
    ]);
    await page.waitForLoadState("domcontentloaded");

    await expect(pagination).toContainText(/Page 2 \/ 2/);
    await expect(countLine).toContainText(/21–22 sur 22/);
  });
});
