// src/lib/jwt.ts
import { SignJWT, jwtVerify } from "jose";

const DEFAULT_ALG = "HS256";

export type JwtPayload = Record<string, unknown>;

export async function signJWT(
  payload: JwtPayload,
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  if (!secret) throw new Error("missing_jwt_secret");
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) throw new Error("invalid_ttl");

  const key = new TextEncoder().encode(secret);
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: DEFAULT_ALG, typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + Math.floor(ttlSeconds))
    .sign(key);
}

export async function verifyJWT<T extends JwtPayload = JwtPayload>(
  token: string,
  secret: string,
): Promise<T> {
  if (!secret) throw new Error("missing_jwt_secret");
  const key = new TextEncoder().encode(secret);

  const { payload } = await jwtVerify(token, key, {
    algorithms: [DEFAULT_ALG],
  });

  return payload as T;
}

export async function safeVerifyJWT<T extends JwtPayload = JwtPayload>(
  token: string,
  secret: string,
): Promise<{ ok: true; payload: T } | { ok: false; error: string }> {
  try {
    const payload = await verifyJWT<T>(token, secret);
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "jwt_invalid" };
  }
}
