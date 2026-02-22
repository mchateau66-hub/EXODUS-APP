import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { generateResetToken, hashResetToken } from "@/lib/password";
import { getClientIp } from "@/lib/ip";
import { limit, rateHeaders } from "@/lib/ratelimit";
import { ok, err } from "@/lib/api-response";
import { sendPasswordResetEmail } from "@/lib/email";
import { writeAuditLog } from "@/lib/audit";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeEmail(s: string) {
  return s.trim().toLowerCase();
}

function isValidEmail(email: string) {
  if (!email || email.length > 180) return false;
  // validation simple mais meilleure que includes("@")
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clampStr(s: string, max: number) {
  const v = (s ?? "").trim();
  return v.length > max ? v.slice(0, max) : v;
}

function emailKey(email: string) {
  // évite de mettre l'email en clair dans la clé rate-limit
  return createHash("sha256").update(email).digest("hex").slice(0, 24);
}

function getBaseUrl(req: NextRequest) {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/+$/, "");
}

function noStore(headers?: Headers) {
  const h = headers ?? new Headers();
  h.set("cache-control", "no-store");
  return h;
}

export async function POST(req: NextRequest) {
  // ✅ Payload size guard (petit payload attendu)
  const cl = req.headers.get("content-length");
  if (cl) {
    const n = Number(cl);
    if (Number.isFinite(n) && n > 8_000) {
      // réponse neutre anti-enum
      return ok({}, { headers: noStore() });
    }
  }

  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = normalizeEmail(body?.email || "");
  if (!isValidEmail(email)) return err("bad_request", 400, {}, { headers: noStore() });

  const ip = getClientIp(req.headers);
  const ua = clampStr(req.headers.get("user-agent") || "", 256);

  // ✅ 5 requêtes / 10 min par IP+email (email hashé)
  const rlKey = `${ip}:${emailKey(email)}`;
  const rl = await limit("pwreset", rlKey, 5, 10 * 60 * 1000);
  const headers = noStore(rateHeaders(rl));

  if (!rl.ok) {
    await writeAuditLog({
      action: "password_reset.rate_limited",
      userId: null,
      email,
      ip,
      ua,
      meta: { key: rlKey },
    });
    // anti-enum : on reste neutre
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
      // anti-enum : répondre OK quand même
    }

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