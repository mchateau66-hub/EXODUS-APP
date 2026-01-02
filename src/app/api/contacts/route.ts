// src/app/api/contacts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromSession } from "@/lib/auth";
import { consumeSAT } from "@/lib/sat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normStr(x: unknown) {
  return typeof x === "string" ? x.trim() : "";
}

/**
 * GET /api/contacts?coachSlug=marie
 * SAT requis si SAT_JWT_SECRET est défini.
 * feature attendu: "contacts.view"
 */
export async function GET(req: NextRequest) {
  const session = await getUserFromSession().catch(() => null);
  const user = (session as any)?.user;

  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  const coachSlug = normStr(req.nextUrl.searchParams.get("coachSlug"));
  if (!coachSlug) {
    return NextResponse.json({ ok: false, error: "missing_coachSlug" }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  const enforceSat = Boolean((process.env.SAT_JWT_SECRET || "").trim());
  if (enforceSat) {
    const satRes = await consumeSAT(req, { allowedFeatures: ["contacts.view"] });

    if (!("ok" in (satRes as any)) || (satRes as any).ok !== true) {
      const r = satRes as Response;
      const h = new Headers(r.headers);
      h.set("cache-control", "no-store");
      return new NextResponse(await r.text().catch(() => "Forbidden"), { status: (r as any).status || 403, headers: h });
    }

    const p = (satRes as any).payload as { sub?: string };
    if (String(p?.sub || "") !== String(user.id)) {
      return NextResponse.json({ ok: false, error: "sat_user_mismatch" }, { status: 403, headers: { "cache-control": "no-store" } });
    }
  }

  const coach = await prisma.coach.findUnique({
    where: { slug: coachSlug },
    select: { slug: true, name: true, user_id: true },
  });

  if (!coach?.user_id) {
    return NextResponse.json({ ok: false, error: "coach_not_found" }, { status: 404, headers: { "cache-control": "no-store" } });
  }

  const coachUser = await prisma.user.findUnique({
    where: { id: String(coach.user_id) },
    select: { email: true },
  });

  return NextResponse.json(
    {
      ok: true,
      coach: { slug: coach.slug, name: coach.name ?? null },
      contact: { email: coachUser?.email ?? null, phone: null },
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
