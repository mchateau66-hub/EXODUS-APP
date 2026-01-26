// src/app/api/e2e/login/route.ts
import { NextRequest } from "next/server";
import { POST as LoginPOST } from "../../login/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ✅ POST = alias direct (types OK)
export async function POST(req: NextRequest) {
  return LoginPOST(req);
}

// ✅ GET = fallback (si un client appelle en GET)
// On transforme les query params -> body JSON -> POST /api/login
export async function GET(req: NextRequest) {
  const url = req.nextUrl;

  const num = (key: string) => {
    const v = url.searchParams.get(key);
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const payload = {
    email: url.searchParams.get("email") ?? undefined,
    plan: url.searchParams.get("plan") ?? undefined,
    role: url.searchParams.get("role") ?? undefined,
    onboardingStep: num("onboardingStep"),
    maxAgeSeconds: num("maxAgeSeconds"),
  };

  const headers = new Headers(req.headers);
  headers.set("content-type", "application/json");

  const target = new URL("/api/login", url.origin);

  const proxyReq = new NextRequest(target, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  return LoginPOST(proxyReq);
}
