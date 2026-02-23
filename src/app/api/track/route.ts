// src/app/api/track/route.ts
import { NextRequest, NextResponse } from "next/server";
import { analyticsStore, type TrackEvent } from "@/lib/analytics-store";
import { getClientIp } from "@/lib/ip";
import { limit, rateHeaders } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_CHARS = 20_000;

// ✅ Events autorisés (whitelist)
const ALLOWED_EVENTS = new Set<string>([
  "page_view",
  "hero_click",
  "pricing_click",
  "sticky_click",
  "finalcta_click",
  "signup_submit",
  "checkout_success",
  "subscription_active",
  "subscription_cancel_scheduled",
  "subscription_reactivated",
  "subscription_canceled",
]);

// ✅ Enums stricts
const ALLOWED_ROLES = new Set(["athlete", "coach", "admin"]);
const ALLOWED_BILLING = new Set(["monthly", "yearly"]);

// ✅ Offers autorisées (adapte si tu as d’autres clés)
const ALLOWED_OFFERS = new Set([
  "standard",
  "premium",
  "athlete_premium",
  "coach_premium",
]);

// ✅ “sources” autorisées (facultatif)
const ALLOWED_SRC = new Set(["web", "landing", "paywall", "email", "ads", "unknown"]);

function safeString(v: unknown, max = 120): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max) : s;
}

function pickFromSet(v: unknown, allowed: Set<string>, max = 80): string | undefined {
  const s = safeString(v, max);
  if (!s) return undefined;
  return allowed.has(s) ? s : undefined;
}

function safeMeta(v: unknown): Record<string, unknown> | undefined {
  if (!v || typeof v !== "object") return undefined;
  try {
    const str = JSON.stringify(v);
    if (str.length > 5000) return undefined;
    return v as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * ✅ Anti-abus cross-site léger:
 * - accepte si same-origin
 * - ou si pas d’Origin (sendBeacon peut parfois ne pas envoyer Origin selon contexte)
 * - sinon refuse
 */
function isAllowedOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;

  const host = req.headers.get("host");
  if (!host) return false;

  // compare origin host <-> host actuel
  try {
    const o = new URL(origin);
    return o.host === host;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // 0) Origin guard (anti spam depuis un autre site)
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden_origin" }, { status: 403 });
  }

  // 1) Rate limit (IP)
  const ip = getClientIp(req.headers);
  const rl = await limit("track", ip, 60, 60_000); // 60/min/IP
  const rlHeaders = rateHeaders(rl);

  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: rlHeaders }
    );
  }

  // 2) Guard taille body si content-length dispo
  const cl = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(cl) && cl > MAX_BODY_CHARS) {
    return NextResponse.json(
      { ok: false, error: "payload_too_large" },
      { status: 413, headers: rlHeaders }
    );
  }

  // 3) Parse JSON
  let body: Partial<TrackEvent> | null = null;
  try {
    body = (await req.json()) as Partial<TrackEvent>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400, headers: rlHeaders }
    );
  }

  const event = safeString(body?.event, 80);
  if (!event) {
    return NextResponse.json(
      { ok: false, error: "invalid_event" },
      { status: 400, headers: rlHeaders }
    );
  }

  // 4) Whitelist event
  if (!ALLOWED_EVENTS.has(event)) {
    return NextResponse.json(
      { ok: false, error: "event_not_allowed" },
      { status: 400, headers: rlHeaders }
    );
  }

  // 5) Enums stricts (si la valeur n’est pas reconnue => undefined)
  const role = pickFromSet(body?.role, ALLOWED_ROLES, 40);
  const billing = pickFromSet(body?.billing, ALLOWED_BILLING, 16);
  const offer = pickFromSet(body?.offer, ALLOWED_OFFERS, 80);
  const src = pickFromSet(body?.src, ALLOWED_SRC, 40) ?? safeString(body?.src, 40);

  analyticsStore.add({
    event,
    role,
    offer,
    billing,
    src,
    ts: typeof body?.ts === "number" ? body.ts : Date.now(),
    path: safeString(body?.path, 300),
    ref: safeString(body?.ref, 500),
    sessionId: safeString(body?.sessionId, 120),
    ua: safeString(body?.ua, 300),
    meta: safeMeta(body?.meta),
  });

  // 6) Réponse légère + headers RL + no-store
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...Object.fromEntries(rlHeaders.entries()),
      "cache-control": "no-store",
    },
  });
}