import { SignJWT, jwtVerify } from 'jose'
const enc = new TextEncoder()
const ENT_SECRET = process.env.ENTITLEMENTS_JWT_SECRET || 'dev_entitlements_secret'
const SAT_SECRET = process.env.SAT_JWT_SECRET || 'dev_sat_secret'
export async function signEntitlements(payload:{sub:string;plan:string}, ttlSec=Number(process.env.ENTITLEMENTS_TTL_S||60)){
  return await new SignJWT({ ...payload, typ:'ENT'}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime(`${ttlSec}s`).sign(enc.encode(ENT_SECRET))
}
export async function signSAT(payload:{sub:string;jti:string}, ttlSec=Number(process.env.SAT_TTL_S||120)){
  return await new SignJWT({ ...payload, typ:'SAT'}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime(`${ttlSec}s`).sign(enc.encode(SAT_SECRET))
}
export async function verifyEntitlements(t:string){ const {payload}=await jwtVerify(t,enc.encode(ENT_SECRET)); if(payload.typ!=='ENT') throw new Error('invalid typ'); return payload as any }
export async function verifySAT(t:string){ const {payload}=await jwtVerify(t,enc.encode(SAT_SECRET)); if(payload.typ!=='SAT') throw new Error('invalid typ'); return payload as any }
