// src/lib/entitlements-guard.ts
import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { logSecurity } from "@/lib/security-log";
import { consumeJtiOnce } from "@/lib/entitlements-jti";
import { getEntitlementsVersionCached } from "@/lib/entitlements-version-cache";
import { HttpError } from "@/lib/http-error";
import { hasFeature as hasFeatureCore } from "@/lib/entitlements-core";

export type EntitlementClaim = {
  sub: string; // userId
  plan: { key: string; name: string; active: boolean };
  planKey: string;
  features: string[];
  sid: string;
  device?: string;
  iat: number; // seconds
  exp: number; // seconds
  jti: string;
  ver: number;
  ev: number;
};

function requestMeta(req?: NextRequest) {
  if (!req) return {};

  return {
    method: req.method,
    path: req.nextUrl?.pathname ?? "unknown",
    ip:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown",
    userAgent: req.headers.get("user-agent") ?? "unknown",
  };
}

function unauthorized(msg = "unauthorized"): never {
  throw new HttpError(401, msg, msg);
}

function forbidden(msg = "forbidden"): never {
  throw new HttpError(403, msg, msg);
}

function timingSafeEq(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function base64urlToBuffer(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

function parseJwtParts(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) unauthorized("invalid_token");
  const [h, p, s] = parts;
  return { headerB64: h, payloadB64: p, sigB64: s };
}

function verifyHs256(token: string, secret: string): unknown {
  const { headerB64, payloadB64, sigB64 } = parseJwtParts(token);

  const headerRaw: unknown = JSON.parse(base64urlToBuffer(headerB64).toString("utf8"));
  const header =
    headerRaw && typeof headerRaw === "object"
      ? (headerRaw as { alg?: unknown; typ?: unknown })
      : null;

  if (!header || header.alg !== "HS256" || header.typ !== "JWT") {
    unauthorized("invalid_token");
  }

  const signingInput = `${headerB64}.${payloadB64}`;
  const expected = crypto.createHmac("sha256", secret).update(signingInput).digest("base64url");

  if (!timingSafeEq(expected, sigB64)) unauthorized("invalid_token");

  const payload: unknown = JSON.parse(base64urlToBuffer(payloadB64).toString("utf8"));
  return payload;
}

function asClaim(payload: unknown): EntitlementClaim {
  if (!payload || typeof payload !== "object") unauthorized("invalid_token");

  const p = payload as Record<string, unknown>;

  const sub = typeof p.sub === "string" ? p.sub : null;
  const ver = typeof p.ver === "number" ? p.ver : null;
  const ev = typeof p.ev === "number" ? p.ev : null;
  const iat = typeof p.iat === "number" ? p.iat : null;
  const exp = typeof p.exp === "number" ? p.exp : null;
  const jti = typeof p.jti === "string" ? p.jti : null;
  const sid = typeof p.sid === "string" ? p.sid : "unknown";

  const plan = p.plan;
  const planOk =
    plan &&
    typeof plan === "object" &&
    typeof (plan as { key?: unknown }).key === "string" &&
    typeof (plan as { name?: unknown }).name === "string" &&
    typeof (plan as { active?: unknown }).active === "boolean";

  const features = Array.isArray(p.features)
    ? p.features.filter((x) => typeof x === "string")
    : [];

  if (!sub || ver == null || ev == null || !iat || !exp || !jti || !planOk) {
    unauthorized("invalid_token");
  }

  return {
    sub,
    planKey: (plan as { key: string }).key,
    ver,
    ev,
    iat,
    exp,
    jti,
    sid,
    plan: {
      key: (plan as { key: string }).key,
      name: (plan as { name: string }).name,
      active: (plan as { active: boolean }).active,
    },
    features,
    device: typeof p.device === "string" ? p.device : undefined,
  };
}

export function requireEntitlementClaim(req: NextRequest): EntitlementClaim {
  const authHeader = req.headers.get("authorization") ?? "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!m) {
    logSecurity("missing_token", requestMeta(req));
    unauthorized("missing_token");
  }

  const token = m[1].trim();

  const secret = process.env.ENTITLEMENTS_JWT_SECRET || "";
  if (!secret) {
    logSecurity("server_misconfigured_entitlements_secret", requestMeta(req), "error");
    throw new HttpError(500, "server_misconfigured", "server misconfigured");
  }

  let claim: EntitlementClaim;

  try {
    const payload = verifyHs256(token, secret);
    claim = asClaim(payload);
  } catch (error) {
    logSecurity("invalid_token", { ...requestMeta(req), error });
    unauthorized("invalid_token");
  }

  const now = Math.floor(Date.now() / 1000);

  if (claim.exp <= now) {
    logSecurity("token_expired", {
      ...requestMeta(req),
      userId: claim.sub,
      jti: claim.jti,
      exp: claim.exp,
      now,
    });
    unauthorized("token_expired");
  }

  const skew = 30;
  if (claim.iat > now + skew) {
    logSecurity("token_iat_in_future", {
      ...requestMeta(req),
      userId: claim.sub,
      jti: claim.jti,
      iat: claim.iat,
      now,
    });
    unauthorized("token_iat_in_future");
  }

  const maxAge = parseInt(process.env.ENTITLEMENTS_MAX_AGE_S || "600", 10);
  if (Number.isFinite(maxAge) && maxAge > 0 && now - claim.iat > maxAge) {
    logSecurity("token_too_old", {
      ...requestMeta(req),
      userId: claim.sub,
      jti: claim.jti,
      iat: claim.iat,
      now,
      maxAge,
    });
    unauthorized("token_too_old");
  }

  const expectedVer = parseInt(process.env.ENTITLEMENTS_CLAIM_VER || "2", 10);
  if (claim.ver !== expectedVer) {
    logSecurity("token_version_mismatch", {
      ...requestMeta(req),
      userId: claim.sub,
      jti: claim.jti,
      claimVer: claim.ver,
      expectedVer,
    });
    unauthorized("token_version_mismatch");
  }

  return claim;
}

async function assertFreshEntitlementsVersion(claim: EntitlementClaim, req?: NextRequest) {
  const dbEv = await getEntitlementsVersionCached(claim.sub);

  if (!dbEv) {
    logSecurity("user_not_found_for_claim", {
      ...requestMeta(req),
      userId: claim.sub,
      jti: claim.jti,
    });
    unauthorized("user_not_found");
  }

  if (dbEv !== claim.ev) {
    logSecurity("stale_entitlements", {
      ...requestMeta(req),
      userId: claim.sub,
      jti: claim.jti,
      claimEv: claim.ev,
      dbEv,
    });
    unauthorized("stale_entitlements");
  }
}

export async function verifyEntitlementClaimFreshAndConsumeJti(
  req: NextRequest,
): Promise<EntitlementClaim> {
  const claim = requireEntitlementClaim(req);
  await assertFreshEntitlementsVersion(claim, req);

  // 🔐 anti-replay JTI (one-time)
  await consumeJtiOnce(claim);
  return claim;
}

export async function requireFeature(
  req: NextRequest,
  featureKey: string,
): Promise<EntitlementClaim> {
  const claim = await verifyEntitlementClaimFreshAndConsumeJti(req);

  if (!hasFeatureCore(claim.features, featureKey)) {
    logSecurity("feature_forbidden", {
      ...requestMeta(req),
      userId: claim.sub,
      jti: claim.jti,
      featureKey,
      planKey: claim.plan.key,
    });
    forbidden("feature_forbidden");
  }

  return claim;
}