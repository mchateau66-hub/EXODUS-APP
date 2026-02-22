import { NextRequest, NextResponse } from "next/server";
import { analyticsStore, type TrackEvent } from "@/lib/analytics-store";
import { limitSeconds, rateHeaders, rateKeyFromRequest } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// --- helpers
function noStore(res: NextResponse) {
  res.headers.set("cache-control", "no-store");
  return res;
}

// 204 = ultra-safe pour analytics (pas d’info aux bots)
function ok204(extraHeaders?: Headers) {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("cache-control", "no-store");
  if (extraHeaders) {
    extraHeaders.forEach((v, k) => res.headers.set(k, v));
  }
  return res;
}

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // sendBeacon peut ne pas le mettre selon contexte
  try {
    const o = new URL(origin);
    return o.host === req.nextUrl.host;
  } catch {
    return false;
  }
}

function clampStr(v: unknown, max: number) {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max) : s;
}

function clampObj(v: unknown, maxChars: number) {
  if (v == null) return undefined;
  if (typeof v !== "object") return undefined;
  try {
    const json = JSON.stringify(v);
    if (json.length > maxChars) return undefined; // drop si trop gros
    return v as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function isFiniteNumber(v: unknown) {
  return typeof v === "number" && Number.isFinite(v);
}

export async function POST(req: NextRequest) {
  // 0) Origin guard (anti cross-site spam)
  if (!sameOrigin(req)) return ok204();

  // 1) Rate limit (ex: 60 req / 60s / IP)
  // Ajuste si tu veux plus strict: 30/min, etc.
  const key = rateKeyFromRequest(req);
  const rl = await limitSeconds("track", key, 60, 60);
  const rlHeaders = rateHeaders(rl);

  if (!rl.ok) {
    // On répond 204 quand même (silencieux), mais on renvoie les headers
    return ok204(rlHeaders);
  }

  // 2) Payload size guard
  // - content-length fiable si présent
  const len = Number(req.headers.get("content-length") || "0");
  if (len && len > 20_000) return ok204(rlHeaders); // 20KB max

  // - sinon on lit en texte et on coupe si trop long
  let raw = "";
  try {
    raw = await req.text();
  } catch {
    return ok204(rlHeaders);
  }
  if (!raw || raw.length > 20_000) return ok204(rlHeaders);

  // 3) Parse JSON robuste
  let body: Partial<TrackEvent> = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return ok204(rlHeaders);
  }

  // 4) Validation + normalisation (anti garbage)
  const event = clampStr(body.event, 64);
  if (!event) return ok204(rlHeaders);

  const payload: TrackEvent = {
    event,

    role: clampStr(body.role, 32),
    offer: clampStr(body.offer, 64),
    billing: clampStr(body.billing, 16),
    src: clampStr(body.src, 64),

    ts: isFiniteNumber(body.ts) ? (body.ts as number) : Date.now(),
    path: clampStr(body.path, 256),
    ref: clampStr(body.ref, 512),
    sessionId: clampStr(body.sessionId, 96),

    // UA peut être énorme → clamp + fallback header
    ua:
      clampStr(body.ua, 256) ??
      clampStr(req.headers.get("user-agent"), 256),

    // meta : drop si trop gros / non sérialisable
    meta: clampObj(body.meta, 2_000),
  };

  // 5) Store (never throw)
  try {
    analyticsStore.add(payload);
  } catch {
    // ignore (analytics must not break app)
  }

  return ok204(rlHeaders);
}