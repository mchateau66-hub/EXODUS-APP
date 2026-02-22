// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * IMPORTANT:
 * - Ne PAS imposer le SAT dans le middleware.
 * - Le SAT est consommé dans les handlers NodeJS (/api/messages, /api/contacts).
 * - /api/sat sert à acquérir le token.
 */

// ✅ mêmes candidats que ton logout (env: SESSION_COOKIE_NAMES="sid,session,...")
const SESSION_COOKIE_CANDIDATES = (process.env.SESSION_COOKIE_NAMES ?? "sid,session")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function withSecurityHeaders(res: NextResponse) {
  res.headers.set("x-content-type-options", "nosniff");
  res.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  return res;
}

function hasSession(req: NextRequest) {
  return SESSION_COOKIE_CANDIDATES.some((name) => Boolean(req.cookies.get(name)?.value));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Laisser passer les assets Next internes / statiques
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  // ✅ Gate PRO: si anon => redirect /paywall?from=<chemin>
  // (stabilise le test E2E "anonymous -> redirect" et évite les 500 sur /pro en remote)
  if (pathname === "/pro" || pathname.startsWith("/pro/")) {
    if (!hasSession(req)) {
      const url = req.nextUrl.clone();
      url.pathname = "/paywall";

      // from = chemin original + querystring éventuelle
      const from = `${pathname}${req.nextUrl.search || ""}`;
      url.searchParams.set("from", from);

      return withSecurityHeaders(NextResponse.redirect(url));
    }
  }

  // ✅ BYPASS: ne jamais appliquer de gate SAT en middleware sur ces routes
  if (
    pathname.startsWith("/api/messages") ||
    pathname.startsWith("/api/contacts") ||
    pathname.startsWith("/api/sat")
  ) {
    return withSecurityHeaders(NextResponse.next());
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
