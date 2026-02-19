// src/app/api/admin/analytics/overview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type RangeKey = "7d" | "30d" | "90d";

function requireAdmin(req: NextRequest) {
  const key = req.headers.get("x-admin-key") || "";
  return Boolean(
    key && process.env.ANALYTICS_ADMIN_KEY && key === process.env.ANALYTICS_ADMIN_KEY
  );
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

function safeRate(num: number, den: number) {
  return den > 0 ? num / den : 0;
}

export async function GET(req: NextRequest) {
  // ✅ protection simple (clé) — même logique que /api/analytics
  if (!requireAdmin(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get("range"));
  const start = rangeToStart(range);
  const end = new Date();

  const role = url.searchParams.get("role") || null;     // coach|athlete|admin
  const offer = url.searchParams.get("offer") || null;   // standard|pro|free...
  const billing = url.searchParams.get("billing") || null; // monthly|yearly

  // Filters consistent avec /api/analytics (DB-first)
  const baseWhere: Prisma.EventWhereInput = {
    ts: { gte: start, lt: end },
    ...(role ? { role: role as any } : {}),
    ...(offer ? { offer } : {}),
    ...(billing ? { billing } : {}),
  };

  // ✅ Distinct sessions (toutes)
  const sessions = await prisma.event.findMany({
    where: baseWhere,
    distinct: ["session_id"],
    select: { session_id: true },
  });
  const sessionsCount = sessions.length;

  // ✅ Funnel sessions (distinct) par étape
  const [heroSessions, pricingSessions, signupSessions, paidSessions] = await Promise.all([
    prisma.event.findMany({
      where: { ...baseWhere, event: "hero_click" as any },
      distinct: ["session_id"],
      select: { session_id: true },
    }),
    prisma.event.findMany({
      where: { ...baseWhere, event: "pricing_click" as any },
      distinct: ["session_id"],
      select: { session_id: true },
    }),
    prisma.event.findMany({
      where: { ...baseWhere, event: "signup_submit" as any },
      distinct: ["session_id"],
      select: { session_id: true },
    }),
    prisma.event.findMany({
      where: { ...baseWhere, event: "checkout_success" as any },
      distinct: ["session_id"],
      select: { session_id: true },
    }),
  ]);

  const heroCount = heroSessions.length;
  const pricingCount = pricingSessions.length;
  const signupCount = signupSessions.length;
  const paidCount = paidSessions.length;

  return NextResponse.json({
    ok: true,
    range,
    window: { start: start.toISOString(), end: end.toISOString() },

    counts: {
      sessions: sessionsCount,
      hero_sessions: heroCount,
      pricing_sessions: pricingCount,
      signup_sessions: signupCount,
      paid_sessions: paidCount,
    },

    rates: {
      signup_rate: safeRate(signupCount, sessionsCount),      // sessions -> signup
      hero_to_signup: safeRate(signupCount, heroCount),       // hero -> signup
      signup_to_paid: safeRate(paidCount, signupCount),       // signup -> paid
      hero_to_paid: safeRate(paidCount, heroCount),           // hero -> paid
    },
  });
}
