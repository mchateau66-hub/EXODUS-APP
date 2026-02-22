// src/app/api/password-reset/confirm/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, hashResetToken } from "@/lib/password";
import { ok, err } from "@/lib/api-response";
import { getClientIp } from "@/lib/ip";
import { writeAuditLog } from "@/lib/audit";
import { limit, rateHeaders } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeToken(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function normalizePassword(v: unknown) {
  return typeof v === "string" ? v : "";
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { token?: string; password?: string }
    | null;

  const token = normalizeToken(body?.token);
  const password = normalizePassword(body?.password);

  const ip = getClientIp(req.headers);
  const ua = req.headers.get("user-agent") || "";

  // ✅ rate limit (ex: 10 / 10 min) — ajuste si tu veux
  const rl = await limit("pwreset_confirm", ip, 10, 10 * 60 * 1000);
  const rH = rateHeaders(rl);

  if (!rl.ok) {
    await writeAuditLog({
      action: "password_reset.confirm_rate_limited",
      userId: null,
      ip,
      ua,
      meta: { key: ip },
    });
    return err("rate_limited", 429, {}, { headers: rH });
  }

  if (!token || !password) {
    await writeAuditLog({
      action: "password_reset.confirm_bad_request",
      userId: null,
      ip,
      ua,
      meta: { hasToken: !!token, hasPassword: !!password },
    });
    return err("bad_request", 400, {}, { headers: rH });
  }

  if (password.length < 8) {
    await writeAuditLog({
      action: "password_reset.confirm_weak_password",
      userId: null,
      ip,
      ua,
      meta: { length: password.length },
    });
    return err("weak_password", 422, {}, { headers: rH });
  }

  const tokenHash = hashResetToken(token);
  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rec = await tx.passwordResetToken.findFirst({
        where: {
          token_hash: tokenHash,
          used_at: null,
          expires_at: { gt: now },
        },
        select: { id: true, user_id: true },
      });

      if (!rec) return { ok: false as const };

      // race-safe consume
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: rec.id, used_at: null },
        data: { used_at: now },
      });

      if (consumed.count !== 1) return { ok: false as const };

      const newHash = await hashPassword(password);

      await tx.user.update({
        where: { id: rec.user_id },
        data: { passwordHash: newHash },
      });

      const sessions = await tx.session.deleteMany({
        where: { user_id: rec.user_id },
      });

      const otherTokens = await tx.passwordResetToken.updateMany({
        where: { user_id: rec.user_id, used_at: null },
        data: { used_at: now },
      });

      return {
        ok: true as const,
        userId: rec.user_id,
        sessionsRevoked: sessions.count,
        otherTokensInvalidated: otherTokens.count,
      };
    });

    if (!result.ok) {
      await writeAuditLog({
        action: "password_reset.confirm_invalid",
        userId: null,
        ip,
        ua,
        meta: { reason: "invalid_or_expired_or_used" },
      });
      return err("invalid_or_expired_token", 400, {}, { headers: rH });
    }

    await writeAuditLog({
      action: "password_reset.confirm_success",
      userId: result.userId,
      ip,
      ua,
      meta: {
        sessionsRevoked: result.sessionsRevoked,
        otherTokensInvalidated: result.otherTokensInvalidated,
      },
    });

    return ok({}, { headers: rH });
  } catch (e) {
    console.error("password_reset_confirm_failed", e);

    await writeAuditLog({
      action: "password_reset.confirm_error",
      userId: null,
      ip,
      ua,
      meta: { errorType: e instanceof Error ? e.name : "unknown" },
    });

    return err("server_error", 500, {}, { headers: rH });
  }
}