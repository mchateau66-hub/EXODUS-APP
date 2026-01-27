// src/app/api/e2e/login/route.ts
import { NextRequest } from "next/server";
import { POST as LoginPOST } from "../../login/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Payload = {
  email?: string;
  plan?: string;
  role?: string;
  onboardingStep?: number;
  maxAgeSeconds?: number;
};

function num(url: URL, key: string) {
  const v = url.searchParams.get(key);
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function cookieAttrs(reqUrl: URL) {
  const secure = reqUrl.protocol === "https:";
  // HttpOnly + SameSite=Lax suffisent pour l’e2e
  return `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

function appendCookie(headers: Headers, name: string, value: string, reqUrl: URL) {
  headers.append("set-cookie", `${name}=${encodeURIComponent(value)}; ${cookieAttrs(reqUrl)}`);
}

function withE2ECookies(res: Response, req: NextRequest, payload: Payload) {
  const headers = new Headers(res.headers);

  // Pose plan/role uniquement si fournis
  if (payload.plan) appendCookie(headers, "e2e_plan", payload.plan, new URL(req.url));
  if (payload.role) appendCookie(headers, "e2e_role", payload.role, new URL(req.url));

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function POST(req: NextRequest) {
  // On clone pour pouvoir lire le body sans “consommer” la request originale
  const clone = req.clone();
  let payload: Payload = {};
  try {
    payload = (await clone.json()) as Payload;
  } catch {
    payload = {};
  }

  const res = await LoginPOST(req);
  return withE2ECookies(res, req, payload);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const payload: Payload = {
    email: url.searchParams.get("email") ?? undefined,
    plan: url.searchParams.get("plan") ?? undefined,
    role: url.searchParams.get("role") ?? undefined,
    onboardingStep: num(url, "onboardingStep"),
    maxAgeSeconds: num(url, "maxAgeSeconds"),
  };

  const headers = new Headers(req.headers);
  headers.delete("content-length");
  headers.delete("transfer-encoding");

  headers.set("x-e2e", headers.get("x-e2e") ?? "1");
  headers.set("content-type", "application/json");
  headers.set("accept", "application/json");

  const target = new URL("/api/login", url.origin);
  const proxyReq = new NextRequest(target, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const res = await LoginPOST(proxyReq);
  return withE2ECookies(res, req, payload);
}
