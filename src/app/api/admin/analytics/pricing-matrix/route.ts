import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

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
    const offerFilter = (url.searchParams.get("offer") || "").trim() || null;
    const billingFilter = (url.searchParams.get("billing") || "").trim() || null;

    // Matrix offer x billing (valeurs null => "—")
    // On calcule par session:
    // - has_hero, has_pricing, has_signup, has_paid
    // Puis on regroupe par (offer,billing)
    const rows = await prisma.$queryRaw<
      Array<{
        offer: string | null;
        billing: string | null;
        sessions: bigint;
        hero_sessions: bigint;
        pricing_sessions: bigint;
        signup_sessions: bigint;
        paid_sessions: bigint;
      }>
    >(Prisma.sql`
      WITH per_session AS (
        SELECT
          "Event"."session_id" AS session_id,
          "Event"."offer" AS offer,
          "Event"."billing" AS billing,

          MAX(CASE WHEN "Event"."event" = CAST('hero_click' AS "EventName") THEN 1 ELSE 0 END) AS has_hero,
          MAX(CASE WHEN "Event"."event" = CAST('pricing_click' AS "EventName") THEN 1 ELSE 0 END) AS has_pricing,
          MAX(CASE WHEN "Event"."event" = CAST('signup_submit' AS "EventName") THEN 1 ELSE 0 END) AS has_signup,
          MAX(CASE WHEN "Event"."event" IN (CAST('checkout_success' AS "EventName"), CAST('subscription_active' AS "EventName")) THEN 1 ELSE 0 END) AS has_paid

        FROM "Event"
        WHERE
          "Event"."ts" >= ${start}
          AND "Event"."ts" < ${end}
          AND (${role}::text IS NULL OR "Event"."role"::text = ${role})
          AND (${offerFilter}::text IS NULL OR COALESCE("Event"."offer",'') = ${offerFilter})
          AND (${billingFilter}::text IS NULL OR COALESCE("Event"."billing",'') = ${billingFilter})
        GROUP BY "Event"."session_id", "Event"."offer", "Event"."billing"
      )
      SELECT
        offer,
        billing,
        COUNT(*)::bigint AS sessions,
        SUM(has_hero)::bigint AS hero_sessions,
        SUM(has_pricing)::bigint AS pricing_sessions,
        SUM(has_signup)::bigint AS signup_sessions,
        SUM(has_paid)::bigint AS paid_sessions
      FROM per_session
      GROUP BY offer, billing
      ORDER BY SUM(has_pricing) DESC, COUNT(*) DESC
      LIMIT 200;
    `);

    // Normalize + compute rates
    const data = rows.map((r) => {
      const sessions = Number(r.sessions);
      const hero_sessions = Number(r.hero_sessions);
      const pricing_sessions = Number(r.pricing_sessions);
      const signup_sessions = Number(r.signup_sessions);
      const paid_sessions = Number(r.paid_sessions);

      return {
        offer: r.offer ?? "—",
        billing: r.billing ?? "—",
        sessions,
        hero_sessions,
        pricing_sessions,
        signup_sessions,
        paid_sessions,

        // drop-off / conv
        pricing_rate_from_hero: safeRate(pricing_sessions, hero_sessions), // hero -> pricing
        signup_rate_from_pricing: safeRate(signup_sessions, pricing_sessions), // pricing -> signup
        paid_rate_from_signup: safeRate(paid_sessions, signup_sessions), // signup -> paid
        hero_to_paid: safeRate(paid_sessions, hero_sessions), // hero -> paid
      };
    });

    // dimensions for UI
    const offers = Array.from(new Set(data.map((x) => x.offer))).sort();
    const billings = Array.from(new Set(data.map((x) => x.billing))).sort();

    return NextResponse.json({
      ok: true,
      range,
      window: { start: start.toISOString(), end: end.toISOString() },
      dims: { offers, billings },
      data,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ? String(e.message) : "Internal error" },
      { status: 500 }
    );
  }
}
