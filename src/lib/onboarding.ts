// src/lib/onboarding.ts
import { redirect } from "next/navigation";
import { getUserFromSession } from "@/lib/auth";

type SessionContext = NonNullable<Awaited<ReturnType<typeof getUserFromSession>>>;

function redirectForStep(step: number) {
  if (step <= 0) return "/onboarding";
  if (step === 1) return "/onboarding/step-2";
  if (step === 2) return "/onboarding/step-3";
  return "/onboarding";
}

/**
 * Vérifie que l'utilisateur est loggé ET a atteint au moins `minStep`
 * dans l'onboarding. Sinon, redirige vers l'étape appropriée.
 *
 * Retourne le SessionContext si tout est OK.
 */
export async function requireOnboardingStep(
  minStep: number = 3,
  opts?: { next?: string }
): Promise<SessionContext> {
  const session = await getUserFromSession();

  if (!session) {
    const next = opts?.next ? `?next=${encodeURIComponent(opts.next)}` : "";
    redirect(`/login${next}`);
  }

  const raw = (session.user as any).onboardingStep ?? 0;
  const step = Number(raw);
  const safeStep = Number.isFinite(step) ? step : 0;

  // ✅ OK => on retourne bien la session
  if (safeStep >= minStep) return session;

  // ❌ pas au bon step => redirect vers la bonne page
  redirect(redirectForStep(safeStep));
}
