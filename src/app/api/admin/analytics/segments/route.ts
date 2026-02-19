import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

function requireAdmin(req: Request) {
  const key = req.headers.get("x-admin-key") || "";
  const expected = process.env.ANALYTICS_ADMIN_KEY || "";
  return Boolean(key && expected && key === expected);
}

type RangeKey = "7d" | "30d" | "90d" | "24h";
type ByKey = "role" | "offer" | "billing";

function parseRange(range: string | null): { label: RangeKey | string; from: Date; to: Date } {
  const r = (range || "30d").trim().toLowerCase();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const to = new Date(now);

  if (r === "24h") return { label: "24h", from: new Date(now - day), to };
  if (r === "7d") return { label: "7d", from: new Date(now - 7 * day), to };
  if (r === "30d") return { label: "30d", from: new Date(now - 30 * day), to };
  if (r === "90d") return { label: "90d", from: new Date(now - 90 * day), to };

  // fallback type "14d"
  const m = r.match(/^(\d+)d$/);
  if (m) {
    const n = Math.max(1, Math.min(3650, Number(m[1])));
    return { label: `${n}d`, from: new Date(now - n * day), to };
  }

  return { label: "30d", from: new Date(now - 30 * day), to };
}

function parseBy(by: string | null): ByKey {
  const b = (by || "role").trim().toLowerCase();
  if (b === "offer") return "offer";
  if (b === "billing") return "billing";
  return "role";
}

function byColumn(by: ByKey) {
  // ✅ whitelist => pas d’injection Prisma.raw
  switch (by) {
    case "offer":
      return Prisma.raw(`"Event"."offer"`);
    case "billing":
      return Prisma.raw(`"Event"."billing"`);
    case "role":
    default:
      return Prisma.raw(`"Event"."role"`);
  }
}

export async function GET(req: Request) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const by = parseBy(searchParams.get("by"));
  const { label: range, from, to } = parseRange(searchParams.get("range"));

  // filtres optionnels (segmentation secondaire)
  const roleFilter = (searchParams.get("role") || "").trim() || null;
  const offerFilter = (searchParams.get("offer") || "").trim() || null;
  const billingFilter = (searchParams.get("billing") || "").trim() || null;

  const col = byColumn(by);

  /**
   * Idée:
   * - On agrège par session_id dans la fenêtre.
   * - Pour chaque session, on calcule :
   *   - segment_key (role/offer/billing)
   *   - has_hero / has_signup / has_paid
   * - Puis on agrège par segment_key.
   *
   * paid = checkout_success OU subscription_active (tu peux changer si tu veux strict)
   */
  const rows = await prisma.$queryRaw<
    Array<{
      key: string | null;
      sessions: bigint;
      hero_sessions: bigint;
      signup_sessions: bigint;
      paid_sessions: bigint;
    }>
  >(Prisma.sql`
    WITH per_session AS (
      SELECT
        "Event"."session_id" AS session_id,
        ${col} AS key,
        MAX(CASE WHEN "Event"."event" = CAST('hero_click' AS "EventName") THEN 1 ELSE 0 END) AS has_hero,
        MAX(CASE WHEN "Event"."event" = CAST('signup_submit' AS "EventName") THEN 1 ELSE 0 END) AS has_signup,
        MAX(CASE WHEN "Event"."event" IN (CAST('checkout_success' AS "EventName"), CAST('subscription_active' AS "EventName")) THEN 1 ELSE 0 END) AS has_paid
      FROM "Event"
      WHERE
        "Event"."ts" >= ${from}
        AND "Event"."ts" <= ${to}
        AND (${roleFilter}::text IS NULL OR "Event"."role"::text = ${roleFilter})
        AND (${offerFilter}::text IS NULL OR COALESCE("Event"."offer",'') = ${offerFilter})
        AND (${billingFilter}::text IS NULL OR COALESCE("Event"."billing",'') = ${billingFilter})
      GROUP BY "Event"."session_id", ${col}
    )
    SELECT
      key,
      COUNT(*)::bigint AS sessions,
      SUM(has_hero)::bigint AS hero_sessions,
      SUM(has_signup)::bigint AS signup_sessions,
      SUM(has_paid)::bigint AS paid_sessions
    FROM per_session
    GROUP BY key
    ORDER BY SUM(has_hero) DESC, COUNT(*) DESC
    LIMIT 50;
  `);

  const data = rows.map((r) => {
    const sessions = Number(r.sessions);
    const hero_sessions = Number(r.hero_sessions);
    const signup_sessions = Number(r.signup_sessions);
    const paid_sessions = Number(r.paid_sessions);

    const hero_to_signup = hero_sessions > 0 ? signup_sessions / hero_sessions : 0;
    const hero_to_paid = hero_sessions > 0 ? paid_sessions / hero_sessions : 0;

    return {
      key: r.key ?? "—",
      sessions,
      hero_sessions,
      signup_sessions,
      paid_sessions,
      hero_to_signup,
      hero_to_paid,
    };
  });

  return NextResponse.json({
    ok: true,
    range,
    by,
    window: { start: from.toISOString(), end: to.toISOString() },
    data,
  });
}
