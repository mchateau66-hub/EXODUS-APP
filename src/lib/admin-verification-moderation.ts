// src/lib/admin-verification-moderation.ts — POST approve/reject (source de vérité serveur)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromSession } from "@/lib/auth";
import { CoachDocStatus, Prisma } from "@prisma/client";
import { limit, rateHeaders } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip";
import { writeAuditLog } from "@/lib/audit";

export type ModerationMode = "approve" | "reject";

/**
 * Accès modération verification (admin aujourd’hui).
 * Extensible : ajouter `moderator` (ou rôle dédié) sans changer le contrat HTTP.
 */
export function canModerateVerification(user: unknown): boolean {
  const u = user as { id?: string; role?: string } | null;
  if (!u?.id) return false;
  const r = String(u.role ?? "").toLowerCase().trim();
  return r === "admin" || r === "moderator";
}

function setRateHeaders(res: NextResponse, rl: ReturnType<typeof rateHeaders>) {
  rl.forEach((v, k) => res.headers.set(k, v));
  return res;
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
      return NextResponse.json({ success: false, error: "invalid_origin" }, { status: 403 });
    }
    return null;
  }

  if (referer) {
    try {
      const ro = normalize(new URL(referer).origin);
      if (allowed.size && !allowed.has(ro)) {
        return NextResponse.json({ success: false, error: "invalid_referer_origin" }, { status: 403 });
      }
      return null;
    } catch {
      // ignore
    }
  }

  if (isProd) {
    return NextResponse.json({ success: false, error: "missing_origin" }, { status: 403 });
  }

  return null;
}

async function parseReason(req: NextRequest): Promise<string | undefined> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) return undefined;
  try {
    const body = (await req.json()) as { reason?: unknown };
    if (typeof body?.reason === "string") {
      const v = body.reason.trim();
      return v.length ? v.slice(0, 4000) : undefined;
    }
  } catch {
    // empty body
  }
  return undefined;
}

/**
 * POST /api/admin/verification/:id/approve|reject — uniquement depuis `pending`, audit log.
 * Réponse : { success, status: 'approved'|'rejected' } (aligné produit ; DB = verified|rejected).
 */
export async function postVerificationModeration(
  req: NextRequest,
  docId: string,
  mode: ModerationMode,
): Promise<NextResponse> {
  if (process.env.FEATURE_ADMIN_DASHBOARD === "0") {
    return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
  }

  const rawSession: unknown = await getUserFromSession();
  const user = (rawSession as any)?.user;

  if (!user?.id) {
    return NextResponse.json({ success: false, error: "invalid_session" }, { status: 401 });
  }
  if (!canModerateVerification(user)) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }

  const limitN = parseInt(process.env.RATELIMIT_ADMIN_LIMIT || "60", 10);
  const windowS = parseInt(process.env.RATELIMIT_ADMIN_WINDOW_S || "300", 10);
  const rl = await limit("admin", user.id, limitN, windowS * 1000);
  const rlH = rateHeaders(rl);

  if (!rl.ok) {
    const res = NextResponse.json({ success: false, error: "rate_limited" }, { status: 429 });
    return setRateHeaders(res, rlH);
  }

  const so = requireSameOrigin(req);
  if (so) return setRateHeaders(so, rlH);

  const id = String(docId || "").trim();
  if (!id) {
    const res = NextResponse.json({ success: false, error: "missing_id" }, { status: 400 });
    return setRateHeaders(res, rlH);
  }

  const reason = await parseReason(req);

  const ip = getClientIp(req.headers);
  const ua = req.headers.get("user-agent") || null;
  const email = (user as any)?.email ?? null;

  const targetStatus: CoachDocStatus = mode === "approve" ? "verified" : "rejected";
  const apiStatusLabel = mode === "approve" ? "approved" : "rejected";

  try {
    const existing = await prisma.coachDocument.findUnique({
      where: { id },
      select: { id: true, status: true, user_id: true },
    });

    if (!existing) {
      await writeAuditLog({
        action: `admin.verification.${mode}_not_found`,
        userId: user.id,
        email,
        ip,
        ua,
        meta: { docId: id },
      });
      const res = NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
      return setRateHeaders(res, rlH);
    }

    if (existing.status !== "pending") {
      await writeAuditLog({
        action: `admin.verification.${mode}_invalid_state`,
        userId: user.id,
        email,
        ip,
        ua,
        meta: { docId: id, currentStatus: existing.status },
      });
      const res = NextResponse.json(
        { success: false, error: "invalid_state", currentStatus: existing.status },
        { status: 409 },
      );
      return setRateHeaders(res, rlH);
    }

    const data: Prisma.CoachDocumentUpdateInput = {
      status: targetStatus,
      reviewed_at: new Date(),
      reviewer: { connect: { id: user.id } },
    };
    if (reason !== undefined) {
      data.review_note = reason;
    }

    await prisma.coachDocument.update({
      where: { id },
      data,
    });

    await writeAuditLog({
      action: `admin.verification.${mode}`,
      userId: user.id,
      email,
      ip,
      ua,
      meta: {
        docId: id,
        newStatus: targetStatus,
        reviewNoteLen: reason?.length ?? 0,
        ...(reason ? { reason } : {}),
      },
    });

    const res = NextResponse.json(
      { success: true, status: apiStatusLabel },
      { status: 200 },
    );
    return setRateHeaders(res, rlH);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "server_error";
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      // Race : document supprimé entre findUnique et update — même action d’audit que not_found (404).
      await writeAuditLog({
        action: `admin.verification.${mode}_not_found`,
        userId: user.id,
        email,
        ip,
        ua,
        meta: { docId: id, prismaCode: "P2025" },
      });
      const res = NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
      return setRateHeaders(res, rlH);
    }

    await writeAuditLog({
      action: `admin.verification.${mode}_error`,
      userId: user.id,
      email,
      ip,
      ua,
      meta: { docId: id, error: msg },
    });

    const res = NextResponse.json({ success: false, error: msg }, { status: 500 });
    return setRateHeaders(res, rlH);
  }
}
