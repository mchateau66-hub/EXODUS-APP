// src/app/api/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { deleteSessionBySid } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE_CANDIDATES = (process.env.SESSION_COOKIE_NAMES ?? "sid,session")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isHttps(req: NextRequest): boolean {
  return (
    req.headers.get("x-forwarded-proto") === "https" ||
    req.nextUrl.protocol === "https:"
  );
}

function expireCookie(
  res: NextResponse,
  name: string,
  opts: { httpOnly: boolean; secure: boolean; sameSite?: "lax" | "strict" | "none" } = {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  },
) {
  res.cookies.set({
    name,
    value: "",
    path: "/",
    httpOnly: opts.httpOnly,
    sameSite: opts.sameSite ?? "lax",
    secure: opts.secure,
    expires: new Date(0),
    maxAge: 0,
  });
}

function makeLogoutResponse(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("cache-control", "no-store");

  // ✅ Expire toutes les variantes possibles des cookies de session
  // (Secure + non-Secure) pour éviter les cas proxy/staging.
  for (const n of SESSION_COOKIE_CANDIDATES) {
    expireCookie(res, n, { httpOnly: true, secure: false, sameSite: "lax" });
    expireCookie(res, n, { httpOnly: true, secure: true, sameSite: "lax" });
  }

  // ✅ Cookie plan (non sensible) : expire aussi en double
  expireCookie(res, "plan", { httpOnly: false, secure: false, sameSite: "lax" });
  expireCookie(res, "plan", { httpOnly: false, secure: true, sameSite: "lax" });

  // Optionnel: si tu as d'autres cookies UI liés au paywall
  // expireCookie(res, "entitlements", { httpOnly: false, secure: false });
  // expireCookie(res, "entitlements", { httpOnly: false, secure: true });

  return res;
}

async function handleLogout(req: NextRequest) {
  // 🔍 Trouve le sid dans un des cookies candidats
  const sid =
    SESSION_COOKIE_CANDIDATES.map((n) => req.cookies.get(n)?.value).find(Boolean) ?? null;

  // ✅ supprime la session côté DB si on a un sid
  if (sid) {
    try {
      await deleteSessionBySid(sid);
    } catch {
      // Ne pas casser le logout si la DB/session cleanup échoue
      // (le cookie est quand même expiré côté client)
    }
  }

  // On renvoie 204 avec cookies expirés
  // secure basé sur protocole utile surtout si tu ajoutes d'autres cookies ici
  const _https = isHttps(req);
  void _https; // lint silence (réservé si tu veux conditionner autre chose)
  return makeLogoutResponse(req);
}

export async function POST(req: NextRequest) {
  return handleLogout(req);
}

export async function GET(req: NextRequest) {
  return handleLogout(req);
}
