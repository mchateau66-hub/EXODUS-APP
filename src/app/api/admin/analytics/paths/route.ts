import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { EventName } from "@prisma/client";

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

function normalizeStep(e: EventName) {
  // On limite aux “funnel steps” pour éviter bruit (tu peux étendre plus tard)
  switch (e) {
    case EventName.hero_click:
      return "hero";
    case EventName.pricing_click:
      return "pricing";
    case EventName.sticky_click:
      return "sticky";
    case EventName.finalcta_click:
      return "finalcta";
    case EventName.signup_submit:
      return "signup";
    case EventName.checkout_start:
      return "checkout_start";
    case EventName.checkout_success:
      return "paid";
    case EventName.subscription_active:
      return "active";
    case EventName.subscription_canceled:
      return "canceled";
    default:
      return null;
  }
}

function buildPathFromSession(events: Array<{ event: EventName; ts: Date }>) {
  // dedupe consécutif + ordre par ts
  const sorted = [...events].sort((a, b) => a.ts.getTime() - b.ts.getTime());
  const out: string[] = [];
  let prev: string | null = null;

  for (const x of sorted) {
    const step = normalizeStep(x.event);
    if (!step) continue;
    if (step === prev) continue;
    out.push(step);
    prev = step;
  }

  // cap pour éviter paths énormes
  return out.slice(0, 12);
}

function keyPath(steps: string[]) {
  return steps.join(" → ");
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const range = parseRange(url.searchParams.get("range"));
    const start = rangeToStart(range);
    const end = new Date();

    const role = (url.searchParams.get("role") || "").trim() || null;
    const offer = (url.searchParams.get("offer") || "").trim() || null;
    const billing = (url.searchParams.get("billing") || "").trim() || null;

    const baseWhere: Prisma.EventWhereInput = {
      ts: { gte: start, lt: end },
      ...(role ? { role: role as any } : {}),
      ...(offer ? { offer } : {}),
      ...(billing ? { billing } : {}),
    };

    // Events “paths” (inclut paid/active/canceled)
    const keep: EventName[] = [
      EventName.hero_click,
      EventName.pricing_click,
      EventName.sticky_click,
      EventName.finalcta_click,
      EventName.signup_submit,
      EventName.checkout_start,
      EventName.checkout_success,
      EventName.subscription_active,
      EventName.subscription_canceled,
    ];

    // ⚠️ pour volume énorme: on fera une version SQL (CTE) ou pré-agrégation.
    // Là: on pull events de la fenêtre, group par session.
    const rows = await prisma.event.findMany({
      where: { ...baseWhere, event: { in: keep } },
      select: { session_id: true, event: true, ts: true },
      orderBy: { ts: "asc" },
    });

    // group by session
    const bySession = new Map<string, Array<{ event: EventName; ts: Date }>>();
    for (const r of rows) {
      const sid = r.session_id || "unknown";
      const arr = bySession.get(sid) ?? [];
      arr.push({ event: r.event, ts: r.ts });
      bySession.set(sid, arr);
    }

    const totalSessions = bySession.size;

    // aggregates
    const all = new Map<string, { count: number; signup: number; paid: number }>();
    const toSignup = new Map<string, number>();
    const toPaid = new Map<string, number>();

    let signupSessions = 0;
    let paidSessions = 0;

    for (const evs of bySession.values()) {
      const steps = buildPathFromSession(evs);
      const path = keyPath(steps);

      const hasSignup = steps.includes("signup");
      const hasPaid = steps.includes("paid") || steps.includes("active");

      if (hasSignup) signupSessions += 1;
      if (hasPaid) paidSessions += 1;

      const a = all.get(path) ?? { count: 0, signup: 0, paid: 0 };
      a.count += 1;
      if (hasSignup) a.signup += 1;
      if (hasPaid) a.paid += 1;
      all.set(path, a);

      if (hasSignup) toSignup.set(path, (toSignup.get(path) ?? 0) + 1);
      if (hasPaid) toPaid.set(path, (toPaid.get(path) ?? 0) + 1);
    }

    const topAll = [...all.entries()]
      .map(([path, v]) => ({
        path,
        sessions: v.count,
        share: totalSessions > 0 ? v.count / totalSessions : 0,
        signup_sessions: v.signup,
        paid_sessions: v.paid,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 20);

    const topSignup = [...toSignup.entries()]
      .map(([path, n]) => ({ path, sessions: n, share: signupSessions > 0 ? n / signupSessions : 0 }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 15);

    const topPaid = [...toPaid.entries()]
      .map(([path, n]) => ({ path, sessions: n, share: paidSessions > 0 ? n / paidSessions : 0 }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 15);

    return NextResponse.json({
      ok: true,
      range,
      window: { start: start.toISOString(), end: end.toISOString() },
      totals: {
        sessions: totalSessions,
        signup_sessions: signupSessions,
        paid_sessions: paidSessions,
      },
      top: {
        all: topAll,
        signup: topSignup,
        paid: topPaid,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ? String(e.message) : "Internal error" },
      { status: 500 }
    );
  }
}
