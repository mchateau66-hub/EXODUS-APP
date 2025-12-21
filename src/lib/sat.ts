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

export function getSatTtlSeconds() {
  const n = parseInt(process.env.SAT_TTL_S || "120", 10);
  return Number.isFinite(n) && n > 0 ? n : 120;
}

/**
 * Crée un SAT (JWT) + stocke un jti one-time en DB (sat_jti).
 * Table attendue (minimum):
 * - sat_jti(jti uuid pk, user_id uuid, issued_at timestamptz, expires_at timestamptz, consumed_at timestamptz null, method text, path text)
 */
export async function issueSAT(params: {
  userId: string;
  feature: string;
  method: string;
  path: string;
}) {
  const secret = process.env.SAT_JWT_SECRET || "";
  if (!secret) throw new Error("missing_sat_secret");

  const now = new Date();
  const ttl = getSatTtlSeconds();
  const exp = new Date(now.getTime() + ttl * 1000);
  const jti = crypto.randomUUID();

  // Stockage jti (anti-replay) — fail closed si la table n'existe pas
  try {
    await prisma.$executeRaw`
      INSERT INTO sat_jti (jti, user_id, issued_at, expires_at, method, path)
      VALUES (${jti}::uuid, ${params.userId}::uuid, ${now}::timestamptz, ${exp}::timestamptz, ${params.method}, ${params.path})
    `;
  } catch (e) {
    throw new Error("sat_store_failed");
  }

  const token = await signJWT(
    {
      sub: params.userId,
      feature: params.feature,
      htm: params.method,
      htu: params.path,
      jti,
    },
    secret,
    ttl,
  );

  return { token, expMs: exp.getTime(), jti };
}

/**
 * Vérifie + consomme le SAT (one-time).
 * - Vérifie signature + exp via jose
 * - Vérifie method/path
 * - Vérifie feature autorisée
 * - Consomme jti atomiquement (UPDATE ... WHERE consumed_at IS NULL AND expires_at > now())
 */
export async function consumeSAT(req: NextRequest, opts: { allowedFeatures: string[] }) {
  const sat = req.headers.get("x-sat") || req.headers.get("X-SAT");
  if (!sat) {
    return NextResponse.json({ ok: false, error: "sat_required" }, { status: 403 });
  }

  const secret = process.env.SAT_JWT_SECRET || "";
  const v = await safeVerifyJWT<SatPayload>(sat, secret);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: "sat_invalid", detail: v.error }, { status: 403 });
  }

  const p = v.payload;

  const method = req.method.toUpperCase();
  const path = req.nextUrl.pathname;

  if ((p.htm || "").toUpperCase() !== method || p.htu !== path) {
    return NextResponse.json(
      {
        ok: false,
        error: "sat_mismatch",
        expected: { method, path },
        got: { htm: p.htm, htu: p.htu },
      },
      { status: 403 },
    );
  }

  if (!opts.allowedFeatures.includes(p.feature)) {
    return NextResponse.json({ ok: false, error: "sat_feature_forbidden" }, { status: 403 });
  }

  if (!p.jti || !p.sub) {
    return NextResponse.json({ ok: false, error: "sat_bad_payload" }, { status: 403 });
  }

  // Consommation atomique (anti-replay)
  const consumed = await prisma.$executeRaw`
    UPDATE sat_jti
    SET consumed_at = now()
    WHERE jti = ${p.jti}::uuid
      AND user_id = ${p.sub}::uuid
      AND consumed_at IS NULL
      AND expires_at > now()
  `;

  const n = typeof consumed === "bigint" ? Number(consumed) : Number(consumed || 0);
  if (!Number.isFinite(n) || n <= 0) {
    return NextResponse.json({ ok: false, error: "sat_replay_or_expired" }, { status: 403 });
  }

  return { ok: true as const, payload: p };
}
