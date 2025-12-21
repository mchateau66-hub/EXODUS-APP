// src/lib/security.ts
import { NextRequest, NextResponse } from "next/server";

function normalizeOrigin(s: string) {
  return s.replace(/\/+$/, "");
}

function getRequestOrigin(req: NextRequest) {
  const proto = (req.headers.get("x-forwarded-proto") || "http").split(",")[0].trim();
  const host =
    (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
  if (!host) return "";
  return normalizeOrigin(`${proto}://${host}`);
}

function getAllowedOrigins(req: NextRequest) {
  const allowed = new Set<string>();
  const reqOrigin = getRequestOrigin(req);
  if (reqOrigin) allowed.add(reqOrigin);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (appUrl) allowed.add(normalizeOrigin(appUrl));

  return allowed;
}

/**
 * Anti-CSRF simple (same-origin) pour routes sensibles
 * - En prod: Origin OU Referer doit matcher l'origine attendue.
 * - En dev: on tolère l'absence d'Origin/Referer (curl/tests).
 */
export function requireSameOrigin(req: NextRequest): Response | null {
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return null;

  const isProd = process.env.NODE_ENV === "production";
  const allowed = getAllowedOrigins(req);

  const origin = (req.headers.get("origin") || "").trim();
  if (origin) {
    const o = normalizeOrigin(origin);
    if (!allowed.has(o)) {
      return NextResponse.json({ ok: false, error: "invalid_origin", origin: o }, { status: 403 });
    }
    return null;
  }

  const referer = (req.headers.get("referer") || "").trim();
  if (referer) {
    let refOrigin = "";
    try {
      refOrigin = normalizeOrigin(new URL(referer).origin);
    } catch {
      refOrigin = "";
    }
    if (refOrigin && !allowed.has(refOrigin)) {
      return NextResponse.json(
        { ok: false, error: "invalid_referer_origin", origin: refOrigin },
        { status: 403 },
      );
    }
    if (refOrigin) return null;
  }

  if (isProd) {
    return NextResponse.json({ ok: false, error: "missing_origin" }, { status: 403 });
  }

  return null;
}

export function requireJson(req: NextRequest): Response | null {
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return null;

  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) {
    return NextResponse.json({ ok: false, error: "unsupported_content_type" }, { status: 415 });
  }
  return null;
}
