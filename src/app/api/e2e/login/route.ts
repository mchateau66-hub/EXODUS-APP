// src/app/api/e2e/login/route.ts
import { NextRequest } from "next/server";
import { POST as LoginPOST } from "../../login/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  return LoginPOST(req);
}

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

  // Important: éviter un content-length incohérent (GET => 0) quand on met un body
  headers.delete("content-length");
  headers.delete("transfer-encoding");

  // S’assure que le handler /api/login te considère bien "E2E"
  headers.set("x-e2e", headers.get("x-e2e") ?? "1");
  headers.set("content-type", "application/json");

  const target = new URL("/api/login", url.origin);

  const proxyReq = new NextRequest(target, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  return LoginPOST(proxyReq);
}
