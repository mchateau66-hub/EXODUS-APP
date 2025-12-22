import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { generateResetToken, hashResetToken } from "@/lib/password";
import { getClientIp } from "@/lib/ip";
import { limit, rateHeaders } from "@/lib/ratelimit";
import { ok, err } from "@/lib/api-response";
import { sendPasswordResetEmail } from "@/lib/email";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmail(s: string) {
  return s.trim().toLowerCase();
}

function getBaseUrl(req: NextRequest) {
  // plus fiable en prod/staging derrière proxy
  return process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = normalizeEmail(body?.email || "");
  if (!email || !email.includes("@")) return err("bad_request", 400);

  const ip = getClientIp(req.headers);
  const ua = req.headers.get("user-agent") || "";

  // ✅ 5 requêtes / 10 min par IP+email
  const rl = await limit("pwreset", `${ip}:${email}`, 5, 10 * 60 * 1000);
  const headers = rateHeaders(rl);

  if (!rl.ok) {
    await writeAuditLog({
      action: "password_reset.rate_limited",
      userId: null,
      email,
      ip,
      ua,
      meta: { key: `${ip}:${email}` },
    });
    return err("too_many_requests", 429, {}, { headers });
  }

  const baseUrl = getBaseUrl(req);

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    await writeAuditLog({
      action: "password_reset.request",
      userId: user?.id ?? null,
      email,
      ip,
      ua,
      meta: { userFound: !!user },
    });

    // anti-enum : même réponse si email inconnu
    if (!user) return ok({}, { headers });

    // Invalider anciens tokens non utilisés
    await prisma.passwordResetToken.updateMany({
      where: { user_id: user.id, used_at: null },
      data: { used_at: new Date() },
    });

    const token = generateResetToken();
    const tokenHash = hashResetToken(token);

    const ttlMin = Math.max(5, parseInt(process.env.PASSWORD_RESET_TTL_MIN || "30", 10));
    const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

    // Envoi email (ne doit jamais casser l'anti-enum)
    try {
      await sendPasswordResetEmail({ to: email, resetUrl, ttlMinutes: ttlMin });
    } catch (e) {
      console.error("password_reset_email_failed", e);
      await writeAuditLog({
        action: "password_reset.email_failed",
        userId: user.id,
        email,
        ip,
        ua,
        meta: { errorType: e instanceof Error ? e.name : "unknown" },
      });
      // on répond ok quand même
    }

    // ✅ resetUrl uniquement en DEV (jamais staging/prod)
    const returnUrl =
      process.env.NODE_ENV === "development" &&
      process.env.RETURN_RESET_URL_IN_RESPONSE === "1";

    return ok(returnUrl ? { resetUrl } : {}, { headers });
  } catch (e) {
    console.error("password_reset_request_failed", e);
    await writeAuditLog({
      action: "password_reset.request_error",
      userId: null,
      email,
      ip,
      ua,
      meta: { errorType: e instanceof Error ? e.name : "unknown" },
    });

    // anti-enum : neutre même en cas d’erreur
    return ok({}, { headers });
  }
}
