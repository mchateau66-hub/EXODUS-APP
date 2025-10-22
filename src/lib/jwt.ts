import jwt, { SignOptions } from 'jsonwebtoken';

export function signJwt(payload: Record<string, unknown>, opts?: SignOptions) {
  return jwt.sign(payload, process.env.JWT_SECRET!, { ...(opts ?? {}), algorithm: 'HS256' });
}
