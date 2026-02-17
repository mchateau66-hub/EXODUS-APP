import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type RangeKey = "7d" | "30d" | "90d";
type ByKey = "role" | "offer" | "billing";

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
function parseBy(input: string | null): ByKey {
  if (input === "role" || input === "offer" || input === "billing") return input;
  return "role";
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ ok: false }, { status: 401 });

  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get("range"));
  const by = parseBy(url.searchParams.get("by"));
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

  // 1) Sessions totales par segment (distinct session_id)
  // Prisma groupBy ne supporte pas "distinct sessions" directement,
  // donc on fait une approche robuste: récupérer (segmentKey, session_id) distincts, puis compter.
  const rows = await prisma.event.findMany({
    where: baseWhere,
    select: {
      session_id: true,
      role: true,
      offer: true,
      billing: true,
      event: true,
    },
  });

  const segKey = (r: typeof rows[number]) => {
    if (by === "role") return r.role ?? "unknown";
    if (by === "offer") return r.offer ?? "unknown";
    return r.billing ?? "unknown";
  };

  type Acc = {
    sessions: Set<string>;
    hero: Set<string>;
    signup: Set<string>;
    paid: Set<string>;
  };

  const map = new Map<string, Acc>();

  for (const r of rows) {
    const key = String(segKey(r));
    const sid = r.session_id || "unknown";
    const acc = map.get(key) ?? { sessions: new Set(), hero: new Set(), signup: new Set(), paid: new Set() };
    acc.sessions.add(sid);

    if (r.event === ("hero_click" as any)) acc.hero.add(sid);
    if (r.event === ("signup_submit" as any)) acc.signup.add(sid);
    if (r.event === ("checkout_success" as any)) acc.paid.add(sid);

    map.set(key, acc);
  }

  const data = [...map.entries()]
    .map(([key, acc]) => {
      const sessions = acc.sessions.size;
      const hero_sessions = acc.hero.size;
      const signup_sessions = acc.signup.size;
      const paid_sessions = acc.paid.size;
      return {
        key,
        sessions,
        hero_sessions,
        signup_sessions,
        paid_sessions,
        hero_to_signup: safeRate(signup_sessions, hero_sessions),
        hero_to_paid: safeRate(paid_sessions, hero_sessions),
      };
    })
    .sort((a, b) => b.hero_sessions - a.hero_sessions);

  return NextResponse.json({
    ok: true,
    range,
    by,
    window: { start: start.toISOString(), end: end.toISOString() },
    data,
  });
}
