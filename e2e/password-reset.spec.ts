import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

function isLocalBase(u: string) {
  return /^(https?:\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/.test(u);
}

const BASE_URL = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

// ✅ Ce test ne peut PAS tourner sur une staging distante sans accès DB.
// - Local: OK (DATABASE_URL local)
// - CI/staging: skip par défaut
const SHOULD_RUN_DB_TESTS =
  process.env.E2E_RUN_DB_TESTS === "1" ||
  (isLocalBase(BASE_URL) && Boolean(process.env.DATABASE_URL));

const prisma = SHOULD_RUN_DB_TESTS ? new PrismaClient() : (null as any);

async function waitForPasswordResetUrlFromResend(opts: {
  apiKey: string;
  to: string;
  subjectIncludes?: string;
  timeoutMs?: number;
}) {
  const { apiKey, to } = opts;
  const subjectIncludes = opts.subjectIncludes ?? "Réinitialisez";
  const timeoutMs = opts.timeoutMs ?? (process.env.CI ? 90_000 : 60_000);

  const startedAt = Date.now();

  async function resendGet<T>(path: string): Promise<T> {
    const r = await fetch(`https://api.resend.com${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok) throw new Error(`resend_http_${r.status}`);
    return (await r.json()) as T;
  }

  while (Date.now() - startedAt < timeoutMs) {
    const list = await resendGet<{
      object: "list";
      data: Array<{ id: string; to: string[]; subject: string; created_at: string }>;
    }>(`/emails?limit=100`);

    const candidates = list.data
      .filter((e) => {
        const createdMs = Date.parse(e.created_at);
        const isRecent = Number.isFinite(createdMs) ? createdMs >= startedAt - 30_000 : true;
        return (
          e.to?.includes(to) &&
          (e.subject || "").toLowerCase().includes(subjectIncludes.toLowerCase()) &&
          isRecent
        );
      })
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

    const hit = candidates[0];
    if (hit) {
      const email = await resendGet<{
        object: "email";
        id: string;
        to: string[];
        subject: string;
        html: string | null;
        text: string | null;
      }>(`/emails/${hit.id}`);

      const blob = `${email.html ?? ""}\n${email.text ?? ""}`;
      const m = blob.match(/https?:\/\/[^\s"']+\/reset-password\?token=[^&\s"']+/);
      if (m?.[0]) return m[0];
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  throw new Error("reset_email_not_found");
}

test.describe("Password reset flow (dev + non-dev)", () => {
  test.beforeAll(() => {
    test.skip(!SHOULD_RUN_DB_TESTS, "DB test skipped (remote staging / no DATABASE_URL). Set E2E_RUN_DB_TESTS=1 to force.");
  });

  test("Password reset flow (dev + non-dev)", async ({ page }) => {
    const resendKey = process.env.E2E_RESEND_API_KEY || "";

    const email = resendKey
      ? `delivered+e2e-reset-${Date.now()}@resend.dev`
      : `e2e-reset-${Date.now()}@example.com`;

    const newPass = "NewPassw0rd!";

    const user = await prisma.user.create({
      data: { email, role: "athlete" },
      select: { id: true },
    });

    try {
      await page.goto(`/forgot-password?email=${encodeURIComponent(email)}`);
      await page.getByRole("button", { name: /envoyer le lien/i }).click();

      const resetUrlEl = page.getByTestId("reset-url");
      const hasResetUrl = await resetUrlEl.isVisible().catch(() => false);

      let resetUrl = "";
      if (hasResetUrl) {
        resetUrl = (await resetUrlEl.textContent())?.trim() || "";
      } else {
        test.skip(!resendKey, "resetUrl non exposée + E2E_RESEND_API_KEY manquante");
        resetUrl = await waitForPasswordResetUrlFromResend({
          apiKey: resendKey,
          to: email,
          timeoutMs: 60_000,
        });
      }

      expect(resetUrl).toContain("/reset-password?token=");

      await page.goto(resetUrl);
      await page.getByLabel(/nouveau mot de passe/i).fill(newPass);
      await page.getByLabel(/confirmer le mot de passe/i).fill(newPass);
      await page.getByRole("button", { name: /mettre à jour/i }).click();
      await expect(page.getByText(/mot de passe mis à jour/i)).toBeVisible();

      const res = await page.request.post("/api/login", {
        data: { email, password: newPass },
      });
      expect(res.ok()).toBeTruthy();

      await page.goto("/hub");
      await expect(page).not.toHaveURL(/\/login/i);
    } finally {
      await prisma.passwordResetToken.deleteMany({ where: { user_id: user.id } }).catch(() => null);
      await prisma.session.deleteMany({ where: { user_id: user.id } }).catch(() => null);
      await prisma.user.delete({ where: { id: user.id } }).catch(() => null);
    }
  });

  test.afterAll(async () => {
    await prisma?.$disconnect?.().catch(() => null);
  });
});
