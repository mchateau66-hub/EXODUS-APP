// src/app/api/admin/coach-documents/batch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromSession } from "@/lib/auth";
import { CoachDocStatus } from "@prisma/client";
import { limit, rateHeaders } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

type Body = {
  ids?: unknown;
  status?: unknown;
  review_note?: unknown; // string | null
};

function isAdmin(user: any): user is { id: string; role: "admin" } {
  return Boolean(user?.id) && user?.role === "admin";
}

function normalizeStatus(input: unknown): string {
  return typeof input === "string" ? input.trim().toLowerCase() : "";
}

function normalizeIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const ids = input.map((x) => String(x).trim()).filter(Boolean);
  return Array.from(new Set(ids));
}

function normalizeReviewNote(input: unknown): string | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (typeof input === "string") {
    const v = input.trim();
    return v.length ? v : null;
  }
  return undefined;
}

function setRateHeaders(res: NextResponse, rl: ReturnType<typeof rateHeaders>) {
  rl.forEach((v, k) => res.headers.set(k, v));
  return res;
}

function isJsonRequest(req: NextRequest) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  return ct.includes("application/json");
}

function requireSameOrigin(req: NextRequest): NextResponse | null {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  const isProd = process.env.NODE_ENV === "production";
  const origin = (req.headers.get("origin") || "").trim();
  const referer = (req.headers.get("referer") || "").trim();

  const proto = (req.headers.get("x-forwarded-proto") || "http").split(",")[0].trim();
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .split(",")[0]
    .trim();

  const expected = host ? `${proto}://${host}`.replace(/\/+$/, "") : "";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");

  const allowed = new Set<string>();
  if (expected) allowed.add(expected);
  if (appUrl) allowed.add(appUrl);

  const normalize = (s: string) => s.replace(/\/+$/, "");

  if (origin) {
    const o = normalize(origin);
    if (allowed.size && !allowed.has(o)) {
      return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });
    }
    return null;
  }

  if (referer) {
    try {
      const ro = normalize(new URL(referer).origin);
      if (allowed.size && !allowed.has(ro)) {
        return NextResponse.json({ ok: false, error: "invalid_referer_origin" }, { status: 403 });
      }
      return null;
    } catch {
      // ignore
    }
  }

  if (isProd) {
    return NextResponse.json({ ok: false, error: "missing_origin" }, { status: 403 });
  }

  return null;
}

export async function PUT(req: NextRequest) {
  if (process.env.FEATURE_ADMIN_DASHBOARD === "0") {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const rawSession: unknown = await getUserFromSession();
  const user = (rawSession as any)?.user;

  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401 });
  }
  if (!isAdmin(user)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // Rate limit (par admin)
  const limitN = parseInt(process.env.RATELIMIT_ADMIN_LIMIT || "60", 10);
  const windowS = parseInt(process.env.RATELIMIT_ADMIN_WINDOW_S || "300", 10);
  const rl = await limit("admin", user.id, limitN, windowS * 1000);
  const rlH = rateHeaders(rl);

  if (!rl.ok) {
    const res = NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    return setRateHeaders(res, rlH);
  }

  const so = requireSameOrigin(req);
  if (so) return setRateHeaders(so, rlH);

  if (!isJsonRequest(req)) {
    const res = NextResponse.json({ ok: false, error: "unsupported_content_type" }, { status: 415 });
    return setRateHeaders(res, rlH);
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const ids = normalizeIds(body.ids);
  const statusRaw = normalizeStatus(body.status);

  if (ids.length === 0) {
    const res = NextResponse.json({ ok: false, error: "missing_ids" }, { status: 400 });
    return setRateHeaders(res, rlH);
  }
  if (ids.length > 500) {
    const res = NextResponse.json({ ok: false, error: "too_many_ids" }, { status: 400 });
    return setRateHeaders(res, rlH);
  }

  if (!statusRaw) {
    const res = NextResponse.json({ ok: false, error: "missing_status" }, { status: 400 });
    return setRateHeaders(res, rlH);
  }

  const allowed = new Set(Object.values(CoachDocStatus));
  if (!allowed.has(statusRaw as CoachDocStatus)) {
    const res = NextResponse.json(
      { ok: false, error: "invalid_status", allowed: Array.from(allowed) },
      { status: 400 },
    );
    return setRateHeaders(res, rlH);
  }

  const status = statusRaw as CoachDocStatus;
  const reviewNote = normalizeReviewNote(body.review_note);

  if (typeof reviewNote === "string" && reviewNote.length > 4000) {
    const res = NextResponse.json({ ok: false, error: "review_note_too_long" }, { status: 400 });
    return setRateHeaders(res, rlH);
  }

  const ip = getClientIp(req.headers);
  const ua = req.headers.get("user-agent") || null;
  const email = (user as any)?.email ?? null;

  try {
    const data: any = {
      status,
      reviewer_id: user.id,
      reviewed_at: new Date(),
    };
    if (reviewNote !== undefined) data.review_note = reviewNote;

    const result = await prisma.coachDocument.updateMany({
      where: { id: { in: ids } },
      data,
    });

    await writeAuditLog({
      action: "admin.coach_document.batch_update",
      userId: user.id,
      email,
      ip,
      ua,
      meta: {
        idsCount: ids.length,
        idsSample: ids.slice(0, 10),
        status,
        reviewNoteSet: reviewNote !== undefined,
        reviewNoteLen: typeof reviewNote === "string" ? reviewNote.length : reviewNote === null ? 0 : null,
        updated: result.count,
      },
    });

    const res = NextResponse.json({ ok: true, updated: result.count }, { status: 200 });
    return setRateHeaders(res, rlH);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server_error";

    await writeAuditLog({
      action: "admin.coach_document.batch_update_error",
      userId: user.id,
      email,
      ip,
      ua,
      meta: { idsCount: ids.length, status, error: msg },
    });

    const res = NextResponse.json({ ok: false, error: msg }, { status: 500 });
    return setRateHeaders(res, rlH);
  }
}
