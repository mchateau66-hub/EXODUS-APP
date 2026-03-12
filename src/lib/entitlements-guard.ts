// src/lib/entitlements-guard.ts
import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { logSecurity } from "@/lib/security-log";
import { consumeJtiOnce } from "@/lib/entitlements-jti";
import { getEntitlementsVersionCached } from "@/lib/entitlements-version-cache";

export type EntitlementClaim = {
  sub: string; // userId
  plan: { key: string; name: string; active: boolean };
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
  const err = new Error(msg);
  (err as any).status = 401;
  throw err;
}

function forbidden(msg = "forbidden"): never {
  const err = new Error(msg);
  (err as any).status = 403;
  throw err;
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

function verifyHs256(token: string, secret: string): any {
  const { headerB64, payloadB64, sigB64 } = parseJwtParts(token);

  const header = JSON.parse(base64urlToBuffer(headerB64).toString("utf8"));
  if (header?.alg !== "HS256" || header?.typ !== "JWT") {
    unauthorized("invalid_token");
  }

  const signingInput = `${headerB64}.${payloadB64}`;
  const expected = crypto.createHmac("sha256", secret).update(signingInput).digest("base64url");

  if (!timingSafeEq(expected, sigB64)) unauthorized("invalid_token");

  const payload = JSON.parse(base64urlToBuffer(payloadB64).toString("utf8"));
  return payload;
}

function asClaim(payload: any): EntitlementClaim {
  if (!payload || typeof payload !== "object") unauthorized("invalid_token");

  const sub = typeof payload.sub === "string" ? payload.sub : null;
  const ver = typeof payload.ver === "number" ? payload.ver : null;
  const ev = typeof payload.ev === "number" ? payload.ev : null;
  const iat = typeof payload.iat === "number" ? payload.iat : null;
  const exp = typeof payload.exp === "number" ? payload.exp : null;
  const jti = typeof payload.jti === "string" ? payload.jti : null;
  const sid = typeof payload.sid === "string" ? payload.sid : "unknown";

  const plan = payload.plan;
  const planOk =
    plan &&
    typeof plan === "object" &&
    typeof plan.key === "string" &&
    typeof plan.name === "string" &&
    typeof plan.active === "boolean";

  const features = Array.isArray(payload.features)
    ? payload.features.filter((x: any) => typeof x === "string")
    : [];

  if (!sub || ver == null || ev == null || !iat || !exp || !jti || !planOk) {
    unauthorized("invalid_token");
  }

  return {
    sub,
    ver,
    ev,
    iat,
    exp,
    jti,
    sid,
    plan: { key: plan.key, name: plan.name, active: plan.active },
    features,
    device: typeof payload.device === "string" ? payload.device : undefined,
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
    const err = new Error("server misconfigured");
    (err as any).status = 500;
    throw err;
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

export async function requireFeature(
  req: NextRequest,
  featureKey: string,
): Promise<EntitlementClaim> {
  const claim = requireEntitlementClaim(req);

  await assertFreshEntitlementsVersion(claim, req);

  // 🔐 anti-replay JTI
  await consumeJtiOnce(claim);

  if (!claim.features.includes(featureKey)) {
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