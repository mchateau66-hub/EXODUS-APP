// e2e/admin-verification-api.spec.ts
import { test, expect, request } from "@playwright/test";

const BASE_URL = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").trim().replace(/\/+$/, "");
const HAS_SESSION_COOKIE = Boolean((process.env.E2E_SESSION_COOKIE || "").trim());
const ADMIN_DOC_ID = (process.env.E2E_ADMIN_DOC_ID || "").trim();

test.describe("Admin verification API (smoke)", () => {
  test("PUT /api/admin/coach-documents/batch → 401 sans cookie", async () => {
    const ctx = await request.newContext({ baseURL: BASE_URL });
    const res = await ctx.put("/api/admin/coach-documents/batch", {
      data: { ids: ["x"], status: "verified" },
    });
    // selon ton guard, ça peut être 401 ou 403, mais 401 est OK si tu l’as codé comme ça
    expect([401, 403]).toContain(res.status());
    await ctx.dispose();
  });

  test("Avec E2E_SESSION_COOKIE → pas 401 (admin => 400, non-admin => 403)", async ({ page }) => {
    test.skip(!HAS_SESSION_COOKIE, "Définis E2E_SESSION_COOKIE (cookie admin recommandé)");

    const res = await page.request.put("/api/admin/coach-documents/batch", {
      data: { status: "verified" }, // missing_ids (volontaire)
    });

    expect([400, 403]).toContain(res.status());

    const body = await res.json().catch(() => ({} as any));
    if (res.status() === 403) expect(body?.error).toBeDefined();
    if (res.status() === 400) expect(body?.error).toBe("missing_ids");
  });

  test("Optionnel: PUT /api/admin/coach-documents/[id] (sid admin + E2E_ADMIN_DOC_ID)", async ({
    page,
  }) => {
    test.skip(!HAS_SESSION_COOKIE, "Définis E2E_SESSION_COOKIE (admin)");
    test.skip(!ADMIN_DOC_ID, "Définis E2E_ADMIN_DOC_ID=<uuid coachDocument>");

    const probe = await page.request.put("/api/admin/coach-documents/batch", {
      data: { status: "verified" }, // missing_ids
    });

    test.skip(probe.status() !== 400, "Le cookie fourni n’est pas admin (403)");

    const ok = await page.request.put(`/api/admin/coach-documents/${ADMIN_DOC_ID}`, {
      data: { status: "needs_review", review_note: "e2e: needs review" },
    });
    expect(ok.status()).toBe(200);

    const bad = await page.request.put(`/api/admin/coach-documents/${ADMIN_DOC_ID}`, {
      data: { status: "nope" },
    });
    expect(bad.status()).toBe(400);
  });
});
