// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * IMPORTANT:
 * - Ne PAS imposer le SAT dans le middleware.
 * - Le SAT est consommé dans les handlers NodeJS (/api/messages, /api/contacts).
 * - /api/sat sert à acquérir le token.
 */

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

  // ✅ BYPASS: ne jamais appliquer de gate SAT en middleware sur ces routes
  if (
    pathname.startsWith("/api/messages") ||
    pathname.startsWith("/api/contacts") ||
    pathname.startsWith("/api/sat")
  ) {
    const res = NextResponse.next();
    res.headers.set("x-content-type-options", "nosniff");
    res.headers.set("referrer-policy", "strict-origin-when-cross-origin");
    return res;
  }

  const res = NextResponse.next();
  res.headers.set("x-content-type-options", "nosniff");
  res.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
