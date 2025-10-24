import jwt, { SignOptions } from 'jsonwebtoken';

type JwtPayload = Record<string, unknown>;

export function signJwt(
  payload: JwtPayload,
  opts?: SignOptions,
): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');

  return jwt.sign(payload, secret, { ...(opts ?? {}) });
}
