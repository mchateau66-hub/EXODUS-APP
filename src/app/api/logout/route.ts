// src/app/api/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookies, deleteSessionBySid } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE_CANDIDATES = (process.env.SESSION_COOKIE_NAMES ?? "sid,session")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function expirePlanCookies(res: NextResponse) {
  // ✅ expire "plan" en double (secure false/true) pour être robuste proxy/staging
  res.cookies.set({
    name: "plan",
    value: "",
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: false,
    expires: new Date(0),
    maxAge: 0,
  });

  res.cookies.set({
    name: "plan",
    value: "",
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: true,
    expires: new Date(0),
    maxAge: 0,
  });
}

function makeLogoutResponse(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("cache-control", "no-store");

  // ✅ efface toutes variantes des cookies session
  clearSessionCookies(res, req);

  // ✅ efface plan
  expirePlanCookies(res);

  return res;
}

async function handleLogout(req: NextRequest) {
  // récupère le sid depuis les cookies candidats
  const sid =
    SESSION_COOKIE_CANDIDATES.map((n) => req.cookies.get(n)?.value).find(Boolean) ?? null;

  if (sid) {
    try {
      await deleteSessionBySid(sid);
    } catch {
      // ne pas casser le logout si la suppression DB échoue
    }
  }

  return makeLogoutResponse(req);
}

export async function POST(req: NextRequest) {
  return handleLogout(req);
}

export async function GET(req: NextRequest) {
  return handleLogout(req);
}
