// src/app/api/e2e/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * ✅ Alias E2E vers /api/login
 * - évite d'avoir 2 logiques différentes
 * - garantit onboardingStep=3 + profils (athlete/coach) + cookies
 * - élimine les bugs "step=0" quand un script tape /api/e2e/login
 */
export { POST } from "../../login/route";

export async function GET() {
  return new Response("Not found", { status: 404 });
}
