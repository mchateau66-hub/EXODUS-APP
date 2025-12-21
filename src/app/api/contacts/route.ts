// src/app/api/contacts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromSession } from "@/lib/auth";
import { verifyJWT } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SatPayload = {
  sub: string;
  feature: string;
  htm: string; // expected method
  htu: string; // expected path
  jti: string;
  exp?: number;
  iat?: number;
  sid?: string;
};

function normStr(x: unknown) {
  return typeof x === "string" ? x.trim() : "";
}

async function consumeSatJti(params: {
  jti: string;
  userId: string;
  method: string;
  path: string;
}) {
  // One-time consumption (anti-replay)
  // Table attendue: sat_jti(jti uuid pk, user_id uuid, expires_at timestamptz, consumed_at timestamptz, method text, path text)
  const result = await prisma.$executeRaw`
    UPDATE sat_jti
    SET consumed_at = now()
    WHERE jti = ${params.jti}::uuid
      AND user_id = ${params.userId}::uuid
      AND consumed_at IS NULL
      AND expires_at > now()
      AND (method IS NULL OR method = ${params.method})
      AND (path IS NULL OR path = ${params.path})
  `;

  const n = typeof result === "bigint" ? Number(result) : Number(result || 0);
  return Number.isFinite(n) && n > 0;
}

/**
 * GET /api/contacts?coachSlug=marie
 *
 * Protégé par SAT:
 * - header: X-SAT
 * - payload.feature === "contacts.view"
 * - payload.htm === "GET"
 * - payload.htu === "/api/contacts"
 * - payload.sub === session.user.id
 * - jti consommé (one-time)
 */
export async function GET(req: NextRequest) {
  const session = await getUserFromSession().catch(() => null);
  const user = (session as any)?.user;

  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const coachSlug = normStr(req.nextUrl.searchParams.get("coachSlug"));
  if (!coachSlug) {
    return NextResponse.json({ ok: false, error: "missing_coachSlug" }, { status: 400 });
  }

  const sat = req.headers.get("x-sat") || req.headers.get("X-SAT");
  if (!sat) {
    return NextResponse.json({ ok: false, error: "sat_required" }, { status: 403 });
  }

  const secret = process.env.SAT_JWT_SECRET || "";
  if (!secret) {
    return NextResponse.json({ ok: false, error: "missing_sat_secret" }, { status: 500 });
  }

  let payload: SatPayload;
  try {
    payload = await verifyJWT<SatPayload>(sat, secret);
  } catch {
    return NextResponse.json({ ok: false, error: "sat_invalid" }, { status: 403 });
  }

  const method = "GET";
  const path = "/api/contacts";

  if (payload.sub !== String(user.id)) {
    return NextResponse.json({ ok: false, error: "sat_user_mismatch" }, { status: 403 });
  }
  if (payload.feature !== "contacts.view") {
    return NextResponse.json({ ok: false, error: "sat_feature_forbidden" }, { status: 403 });
  }
  if ((payload.htm || "").toUpperCase() !== method || payload.htu !== path) {
    return NextResponse.json(
      {
        ok: false,
        error: "sat_mismatch",
        expected: { method, path },
        got: { htm: payload.htm, htu: payload.htu },
      },
      { status: 403 },
    );
  }
  if (!payload.jti) {
    return NextResponse.json({ ok: false, error: "sat_missing_jti" }, { status: 403 });
  }

  const consumed = await consumeSatJti({
    jti: payload.jti,
    userId: String(user.id),
    method,
    path,
  }).catch(() => false);

  if (!consumed) {
    return NextResponse.json({ ok: false, error: "sat_replay_or_expired" }, { status: 403 });
  }

  // Fetch coach + email (safe fields only)
  const coach = await prisma.coach.findUnique({
    where: { slug: coachSlug },
    select: { slug: true, name: true, user_id: true },
  });

  if (!coach?.user_id) {
    return NextResponse.json({ ok: false, error: "coach_not_found" }, { status: 404 });
  }

  const coachUser = await prisma.user.findUnique({
    where: { id: String(coach.user_id) },
    select: { email: true },
  });

  return NextResponse.json(
    {
      ok: true,
      coach: {
        slug: coach.slug,
        name: coach.name ?? null,
      },
      contact: {
        email: coachUser?.email ?? null,
        phone: null, // si vous avez un champ phone quelque part, on le branchera ici
      },
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
