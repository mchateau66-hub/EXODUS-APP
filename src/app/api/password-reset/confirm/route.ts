import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, hashResetToken } from "@/lib/password";
import { ok, err } from "@/lib/api-response";
import { getClientIp } from "@/lib/ip";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { token?: string; password?: string }
    | null;

  const token = (body?.token || "").trim();
  const password = body?.password || "";

  const ip = getClientIp(req.headers);
  const ua = req.headers.get("user-agent") || "";

  if (!token || !password) {
    await writeAuditLog({
      action: "password_reset.confirm_bad_request",
      userId: null,
      ip,
      ua,
      meta: { hasToken: !!token, hasPassword: !!password },
    });
    return err("bad_request", 400);
  }

  if (password.length < 8) {
    await writeAuditLog({
      action: "password_reset.confirm_weak_password",
      userId: null,
      ip,
      ua,
      meta: { length: password.length },
    });
    return err("weak_password", 422);
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

      // ✅ Consommer le token de façon "race-safe"
      // Si 2 requêtes arrivent en même temps, une seule doit réussir.
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: rec.id, used_at: null },
        data: { used_at: now },
      });

      if (consumed.count !== 1) return { ok: false as const };

      // Hash mot de passe (await safe même si sync)
      const newHash = await hashPassword(password);

      await tx.user.update({
        where: { id: rec.user_id },
        data: { passwordHash: newHash },
      });

      // Invalider toutes les sessions existantes (force reconnexion)
      const sessions = await tx.session.deleteMany({
        where: { user_id: rec.user_id },
      });

      // Invalider tous les autres tokens reset non utilisés pour cet utilisateur
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
      return err("invalid_or_expired_token", 400);
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

    return ok({});
  } catch (e) {
    console.error("password_reset_confirm_failed", e);

    await writeAuditLog({
      action: "password_reset.confirm_error",
      userId: null,
      ip,
      ua,
      meta: { errorType: e instanceof Error ? e.name : "unknown" },
    });

    return err("server_error", 500);
  }
}
