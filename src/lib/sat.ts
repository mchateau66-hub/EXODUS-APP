// src/lib/sat.ts
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeVerifyJWT, signJWT } from "@/lib/jwt";

export type SatPayload = {
  sub: string;
  feature: string;
  htm: string;
  htu: string;
  jti: string;
  iat?: number;
  exp?: number;
};

type MemEntry = {
  userId: string;
  expMs: number;
  method: string;
  path: string;
};

// Fallback mémoire (dev/e2e) : anti-replay OK en mono-process
const memJti = new Map<string, MemEntry>();

function memCleanup(now = Date.now()) {
  for (const [k, v] of memJti.entries()) {
    if (v.expMs <= now) memJti.delete(k);
  }
}

export function getSatTtlSeconds() {
  const n = parseInt(process.env.SAT_TTL_S || "120", 10);
  return Number.isFinite(n) && n > 0 ? n : 120;
}

/**
 * Normalise un "path" pour SAT:
 * - accepte "/api/messages" ou URL complète "http://..../api/messages?x=1"
 * - supprime query/hash
 * - refuse les chemins externes / chelous
 */
export function normalizeSatPath(input: string) {
  const raw = (input ?? "").trim();
  if (!raw) return "";

  // URL complète -> pathname
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const u = new URL(raw);
      return u.pathname.replace(/\/{2,}/g, "/");
    } catch {
      return "";
    }
  }

  const noHash = raw.split("#")[0] ?? raw;
  const noQuery = (noHash.split("?")[0] ?? noHash).trim();

  if (!noQuery.startsWith("/")) return "";
  if (noQuery.startsWith("//")) return "";
  if (noQuery.includes("://")) return "";

  return noQuery.replace(/\/{2,}/g, "/");
}

/**
 * ✅ Assure l'existence de la table sat_jti (utile en dev/e2e/CI)
 * - évite le fallback mémoire multi-process (qui cause sat_replay_or_expired)
 */
async function ensureSatTable() {
  // On ne tente l'auto-create qu'hors prod
  if (process.env.NODE_ENV === "production") return;

  // Postgres: CREATE TABLE IF NOT EXISTS + index
  // (si tu es sur une autre DB, dis-moi et j’adapte)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sat_jti (
      jti uuid PRIMARY KEY,
      user_id uuid NOT NULL,
      issued_at timestamptz NOT NULL,
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz NULL,
      method text NOT NULL,
      path text NOT NULL
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS sat_jti_user_id_idx ON sat_jti (user_id);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS sat_jti_expires_at_idx ON sat_jti (expires_at);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS sat_jti_consumed_at_idx ON sat_jti (consumed_at);
  `);
}

/**
 * Crée un SAT (JWT) + stocke un jti one-time en DB (sat_jti) si possible.
 * Si la table n'existe pas, on la crée (dev/e2e/CI) puis on réessaie.
 * Si DB KO, fallback mémoire (dernier recours).
 */
export async function issueSAT(params: { userId: string; feature: string; method: string; path: string }) {
  const secret = (process.env.SAT_JWT_SECRET || "").trim();
  if (!secret) throw new Error("missing_sat_secret");

  const now = new Date();
  const ttl = getSatTtlSeconds();
  const exp = new Date(now.getTime() + ttl * 1000);
  const jti = crypto.randomUUID();

  const method = params.method.toUpperCase();
  const path = normalizeSatPath(params.path);
  if (!path) throw new Error("invalid_path");

  // 1) Tentative DB
  try {
    await prisma.$executeRaw`
      INSERT INTO sat_jti (jti, user_id, issued_at, expires_at, method, path)
      VALUES (${jti}::uuid, ${params.userId}::uuid, ${now}::timestamptz, ${exp}::timestamptz, ${method}, ${path})
    `;
  } catch {
    // 2) Si table absente en dev/e2e, on la crée puis on retente une fois
    try {
      await ensureSatTable();
      await prisma.$executeRaw`
        INSERT INTO sat_jti (jti, user_id, issued_at, expires_at, method, path)
        VALUES (${jti}::uuid, ${params.userId}::uuid, ${now}::timestamptz, ${exp}::timestamptz, ${method}, ${path})
      `;
    } catch {
      // 3) Dernier recours : mémoire (mono-process)
      memCleanup();
      memJti.set(jti, { userId: params.userId, expMs: exp.getTime(), method, path });
    }
  }

  const token = await signJWT(
    { sub: params.userId, feature: params.feature, htm: method, htu: path, jti },
    secret,
    ttl,
  );

  return { token, expMs: exp.getTime(), jti };
}

/**
 * Vérifie + consomme le SAT (one-time).
 */
export async function consumeSAT(req: NextRequest, opts: { allowedFeatures: string[] }) {
  const sat = req.headers.get("x-sat") || req.headers.get("X-SAT");
  if (!sat) return NextResponse.json({ ok: false, error: "sat_required" }, { status: 403 });

  const secret = (process.env.SAT_JWT_SECRET || "").trim();
  const v = await safeVerifyJWT<SatPayload>(sat, secret);
  if (!v.ok) return NextResponse.json({ ok: false, error: "sat_invalid", detail: v.error }, { status: 403 });

  const p = v.payload;

  const method = req.method.toUpperCase();
  const path = req.nextUrl.pathname;

  if ((p.htm || "").toUpperCase() !== method || p.htu !== path) {
    return NextResponse.json(
      { ok: false, error: "sat_mismatch", expected: { method, path }, got: { htm: p.htm, htu: p.htu } },
      { status: 403 },
    );
  }

  if (!opts.allowedFeatures.includes(p.feature)) {
    return NextResponse.json({ ok: false, error: "sat_feature_forbidden" }, { status: 403 });
  }

  if (!p.jti || !p.sub) {
    return NextResponse.json({ ok: false, error: "sat_bad_payload" }, { status: 403 });
  }

  // ✅ DB d'abord (fiable multi-process)
  try {
    const consumed = await prisma.$executeRaw`
      UPDATE sat_jti
      SET consumed_at = now()
      WHERE jti = ${p.jti}::uuid
        AND user_id = ${p.sub}::uuid
        AND consumed_at IS NULL
        AND expires_at > now()
    `;
    const n = typeof consumed === "bigint" ? Number(consumed) : Number(consumed || 0);
    if (Number.isFinite(n) && n > 0) return { ok: true as const, payload: p };
  } catch {
    // si table absente en dev/e2e, on la crée (puis on laisse fallback mémoire gérer)
    try {
      await ensureSatTable();
    } catch {
      // ignore
    }
  }

  // Fallback mémoire (mono-process)
  memCleanup();
  const entry = memJti.get(p.jti);
  if (
    !entry ||
    entry.userId !== String(p.sub) ||
    entry.method !== method ||
    entry.path !== path ||
    entry.expMs <= Date.now()
  ) {
    return NextResponse.json({ ok: false, error: "sat_replay_or_expired" }, { status: 403 });
  }

  memJti.delete(p.jti);
  return { ok: true as const, payload: p };
}
