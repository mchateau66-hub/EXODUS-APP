// src/app/api/e2e/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { POST as LoginPOST } from "../../login/route";

// ✅ POST = alias direct
export async function POST(req: Request) {
  return LoginPOST(req);
}

// ✅ GET = fallback pour les environnements où /api/login n'accepte que GET
// ou quand Playwright bascule GET après un 405.
export async function GET(req: Request) {
  const url = new URL(req.url);

  const payload = {
    email: url.searchParams.get("email") ?? undefined,
    plan: url.searchParams.get("plan") ?? undefined,
    role: url.searchParams.get("role") ?? undefined,
    onboardingStep: url.searchParams.get("onboardingStep")
      ? Number(url.searchParams.get("onboardingStep"))
      : undefined,
    maxAgeSeconds: url.searchParams.get("maxAgeSeconds")
      ? Number(url.searchParams.get("maxAgeSeconds"))
      : undefined,
  };

  const headers = new Headers(req.headers);
  headers.set("content-type", "application/json");

  const proxyReq = new Request(new URL("/api/login", url.origin), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  return LoginPOST(proxyReq);
}
