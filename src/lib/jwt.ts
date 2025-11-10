import jwt, { JwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken';

export function signJwt<T extends object = Record<string, unknown>>(
  payload: T,
  secret: string,
  options: SignOptions = { algorithm: 'HS256', expiresIn: '7d' }
): string {
  return jwt.sign(payload as object, secret, options);
}

export function verifyJwt<T extends object = JwtPayload>(
  token: string,
  secret: string,
  options?: VerifyOptions
): T | null {
  try {
    const decoded = jwt.verify(token, secret, options);
    if (typeof decoded === 'string') return null;
    return decoded as T;
  } catch {
    return null;
  }
}
