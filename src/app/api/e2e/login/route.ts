// src/app/api/e2e/login/route.ts
import { NextRequest } from "next/server";
import { POST as LoginPOST } from "../../login/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type LoginPayload = {
  email?: string;
  plan?: string;
  role?: string;
  onboardingStep?: number;
  maxAgeSeconds?: number;
};

function cookieKV(name: string, value: string, maxAgeSeconds = 60 * 60 * 24) {
  // Cookies lisibles côté serveur (HttpOnly ok), sécurisés, pour HTTPS Vercel
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

function withE2ECookies(res: Response, payload: LoginPayload) {
  const plan = (payload.plan ?? "").trim();
  const role = (payload.role ?? "").trim();

  // si pas de plan/role, on ne touche pas
  if (!plan || !role) return res;

  const headers = new Headers(res.headers);

  // cookies E2E pour /api/sat (fallback)
  headers.append("set-cookie", cookieKV("e2e_plan", plan));
  headers.append("set-cookie", cookieKV("e2e_role", role));

  // optionnel : si tu veux aussi exposer onboardingStep, décommente
  // if (typeof payload.onboardingStep === "number") {
  //   headers.append("set-cookie", cookieKV("e2e_onboardingStep", String(payload.onboardingStep)));
  // }

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export async function POST(req: NextRequest) {
  // On lit le body via clone() pour ne pas consommer le stream original
  const cloned = req.clone();
  let payload: LoginPayload = {};
  try {
    payload = (await cloned.json()) as LoginPayload;
  } catch {
    payload = {};
  }

  const res = await LoginPOST(req);
  return withE2ECookies(res, payload);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;

  const num = (key: string) => {
    const v = url.searchParams.get(key);
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const payload: LoginPayload = {
    email: url.searchParams.get("email") ?? undefined,
    plan: url.searchParams.get("plan") ?? undefined,
    role: url.searchParams.get("role") ?? undefined,
    onboardingStep: num("onboardingStep"),
    maxAgeSeconds: num("maxAgeSeconds"),
  };

  const headers = new Headers(req.headers);
  headers.delete("content-length");
  headers.delete("transfer-encoding");

  // S’assure que /api/login te considère bien "E2E"
  headers.set("x-e2e", headers.get("x-e2e") ?? "1");
  headers.set("content-type", "application/json");

  const target = new URL("/api/login", url.origin);

  const proxyReq = new NextRequest(target, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const res = await LoginPOST(proxyReq);
  return withE2ECookies(res, payload);
}
