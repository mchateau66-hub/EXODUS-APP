// src/lib/audit.ts
import crypto from "node:crypto";
import { prisma } from "@/lib/db";

type Meta = Record<string, unknown>;

const SALT = process.env.AUDIT_LOG_SALT || "";

function sha256(input: string) {
  return crypto.createHash("sha256").update(SALT + input).digest("hex");
}

export async function writeAuditLog(params: {
  action: string;
  userId?: string | null;
  email?: string | null;
  ip?: string | null;
  ua?: string | null;
  meta?: Meta;
}) {
  const meta: Meta = { ...(params.meta || {}) };

  // pas de PII en clair
  if (params.email) meta.email_hash = sha256(params.email.toLowerCase());
  if (params.ip) meta.ip_hash = sha256(params.ip);
  if (params.ua) meta.ua_hash = sha256(params.ua);

  try {
    const p = prisma as any;

    // compatible si ton modèle Prisma s'appelle audit_logs (snake) OU auditLog (Pascal)
    if (p.audit_logs) {
      await p.audit_logs.create({
        data: { user_id: params.userId ?? null, action: params.action, meta },
      });
      return;
    }
    if (p.auditLog) {
      await p.auditLog.create({
        data: { user_id: params.userId ?? null, action: params.action, meta },
      });
      return;
    }

    // si aucun modèle n’existe, on ignore (best-effort)
  } catch {
    // ne jamais casser le flow auth/reset à cause de l’audit
  }
}
