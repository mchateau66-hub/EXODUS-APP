// src/lib/audit.ts
import crypto from "node:crypto";
import { prisma } from "@/lib/db";

type Meta = Record<string, unknown>;

const SALT = process.env.AUDIT_LOG_SALT || "";

function sha256(input: string) {
  return crypto.createHash("sha256").update(SALT + input).digest("hex");
}

function stripPII(meta: Meta) {
  const clone: Meta = { ...meta };
  delete (clone as any).email;
  delete (clone as any).ip;
  delete (clone as any).ua;
  delete (clone as any).userAgent;
  return clone;
}

export async function writeAuditLog(params: {
  action: string;
  userId?: string | null;
  email?: string | null;
  ip?: string | null;
  ua?: string | null;
  meta?: Meta;
}) {
  const base = stripPII(params.meta || {});
  const meta: Meta = { ...base };

  if (params.email) meta.email_hash = sha256(params.email.toLowerCase());
  if (params.ip) meta.ip_hash = sha256(params.ip);
  if (params.ua) meta.ua_hash = sha256(params.ua);

  try {
    const p = prisma as any;

    if (p.audit_logs?.create) {
      await p.audit_logs.create({
        data: { user_id: params.userId ?? null, action: params.action, meta },
      });
      return;
    }
    if (p.auditLog?.create) {
      await p.auditLog.create({
        data: { user_id: params.userId ?? null, action: params.action, meta },
      });
      return;
    }
  } catch {
    // never break flows
  }
}
