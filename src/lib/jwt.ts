import { SignJWT, jwtVerify } from 'jose'

const DEFAULT_ALG = 'HS256'

export type JwtPayload = Record<string, unknown>

export async function signJWT(
  payload: JwtPayload,
  secret: string,
  ttlSeconds: number
): Promise<string> {
  const key = new TextEncoder().encode(secret)
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: DEFAULT_ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(key)
}

export async function verifyJWT<T extends JwtPayload = JwtPayload>(
  token: string,
  secret: string
): Promise<T> {
  const key = new TextEncoder().encode(secret)
  const { payload } = await jwtVerify(token, key)
  return payload as T
}
