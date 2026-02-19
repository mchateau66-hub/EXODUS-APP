import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma, EventName } from "@prisma/client";

export const runtime = "nodejs";

type RangeKey = "7d" | "30d" | "90d";

function requireAdmin(req: NextRequest) {
  const key = req.headers.get("x-admin-key") || "";
  return Boolean(key && process.env.ANALYTICS_ADMIN_KEY && key === process.env.ANALYTICS_ADMIN_KEY);
}

function parseRange(input: string | null): RangeKey {
  if (input === "7d" || input === "30d" || input === "90d") return input;
  return "30d";
}

function rangeToStart(range: RangeKey) {
  const now = new Date();
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const start = new Date(now);
  start.setDate(now.getDate() - days);
  return start;
}

function safeRate(n: number, d: number) {
  return d > 0 ? n / d : 0;
}

function percentile(sortedAsc: number[], p: number): number | null {
  if (!sortedAsc.length) return null;
  const idx = Math.ceil(p * sortedAsc.length) - 1;
  const i = Math.max(0, Math.min(sortedAsc.length - 1, idx));
  return sortedAsc[i];
}

type Times = {
  hero_ts?: number;
  pricing_ts?: number;
  sticky_ts?: number;
  finalcta_ts?: number;
  signup_ts?: number;
};

function bucketLabel(ms: number): string {
  const s = ms / 1000;
  if (s < 30) return "<30s";
  if (s < 60) return "30-60s";
  if (s < 120) return "1-2m";
  if (s < 300) return "2-5m";
  return "5m+";
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ ok: false }, { status: 401 });

  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get("range"));
  const start = rangeToStart(range);
  const end = new Date();

  const role = url.searchParams.get("role") || null;
  const offer = url.searchParams.get("offer") || null;
  const billing = url.searchParams.get("billing") || null;

  const baseWhere: Prisma.EventWhereInput = {
    ts: { gte: start, lt: end },
    ...(role ? { role: role as any } : {}),
    ...(offer ? { offer } : {}),
    ...(billing ? { billing } : {}),
  };

  // On ne prend que les events utiles behavior pour réduire volume
  const keep: EventName[] = [
    "hero_click",
    "pricing_click",
    "sticky_click",
    "finalcta_click",
    "signup_submit",
  ];

  const rows = await prisma.event.findMany({
    where: { ...baseWhere, event: { in: keep } },
    select: { session_id: true, event: true, ts: true },
    orderBy: { ts: "asc" },
  });

  // group by session + first occurrence timestamps
  const bySession = new Map<string, Times>();

  for (const r of rows) {
    const sid = r.session_id || "unknown";
    const t = bySession.get(sid) ?? {};
    const ms = r.ts.getTime();

    // store first timestamp for each event
    switch (r.event) {
      case "hero_click":
        if (t.hero_ts == null) t.hero_ts = ms;
        break;
      case "pricing_click":
        if (t.pricing_ts == null) t.pricing_ts = ms;
        break;
      case "sticky_click":
        if (t.sticky_ts == null) t.sticky_ts = ms;
        break;
      case "finalcta_click":
        if (t.finalcta_ts == null) t.finalcta_ts = ms;
        break;
      case "signup_submit":
        if (t.signup_ts == null) t.signup_ts = ms;
        break;
    }
    bySession.set(sid, t);
  }

  const sessions = bySession.size;

  // --- Sticky influence (among signup sessions)
  let signupSessions = 0;
  let signupWithSticky = 0;
  let signupWithoutSticky = 0;

  // --- Fast lane vs Slow lane (among signup sessions)
  let fastLane = 0; // signup without pricing
  let slowLane = 0; // signup after pricing

  // --- Time to convert (hero -> signup, or first touch -> signup)
  const heroToSignup: number[] = [];
  const firstTouchToSignup: number[] = [];
  const hist: Record<string, number> = { "<30s": 0, "30-60s": 0, "1-2m": 0, "2-5m": 0, "5m+": 0 };

  for (const t of bySession.values()) {
    if (!t.signup_ts) continue;
    signupSessions += 1;

    const stickyBeforeSignup = t.sticky_ts != null && t.sticky_ts < t.signup_ts;
    if (stickyBeforeSignup) signupWithSticky += 1;
    else signupWithoutSticky += 1;

    const pricingBeforeSignup = t.pricing_ts != null && t.pricing_ts < t.signup_ts;
    if (pricingBeforeSignup) slowLane += 1;
    else fastLane += 1;

    // first touch = min of all known clicks
    const touches = [t.hero_ts, t.pricing_ts, t.sticky_ts, t.finalcta_ts].filter(
      (x): x is number => typeof x === "number"
    );
    const firstTouch = touches.length ? Math.min(...touches) : null;

    if (t.hero_ts != null) {
      const d = t.signup_ts - t.hero_ts;
      if (d >= 0) heroToSignup.push(d);
    }

    if (firstTouch != null) {
      const d2 = t.signup_ts - firstTouch;
      if (d2 >= 0) {
        firstTouchToSignup.push(d2);
        hist[bucketLabel(d2)] += 1;
      }
    }
  }

  heroToSignup.sort((a, b) => a - b);
  firstTouchToSignup.sort((a, b) => a - b);

  const p50 = percentile(firstTouchToSignup, 0.5);
  const p75 = percentile(firstTouchToSignup, 0.75);
  const p90 = percentile(firstTouchToSignup, 0.9);

  return NextResponse.json({
    ok: true,
    range,
    window: { start: start.toISOString(), end: end.toISOString() },
    counts: {
      sessions,
      signup_sessions: signupSessions,
      signup_with_sticky: signupWithSticky,
      signup_without_sticky: signupWithoutSticky,
      fast_lane: fastLane,
      slow_lane: slowLane,
    },
    rates: {
      sticky_influence_rate: safeRate(signupWithSticky, signupSessions), // among signup sessions
      fast_lane_rate: safeRate(fastLane, signupSessions),
      slow_lane_rate: safeRate(slowLane, signupSessions),
    },
    time_to_convert_ms: {
      p50,
      p75,
      p90,
      sample_size: firstTouchToSignup.length,
      histogram: hist, // based on first_touch -> signup
      hero_to_signup_p50: percentile(heroToSignup, 0.5),
    },
  });
}
