// src/lib/password.ts
import 'server-only'
import { createHash, randomBytes, scryptSync } from 'node:crypto'

/**
 * Base64url (sans padding) stable
 */
function b64urlFromBuffer(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function b64urlToBuffer(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const base64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  return Buffer.from(base64, 'base64')
}

/**
 * Vue Uint8Array d'un Buffer (sans copie)
 * -> pratique pour éviter les soucis de typage Buffer vs ArrayBufferLike
 */
function toU8(buf: Buffer): Uint8Array {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

/**
 * Comparaison "constant-time"
 * (ici longueurs identiques en pratique car on compare des hashes de même taille)
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/**
 * Format stockage : scrypt$<saltB64url>$<hashB64url>
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16) // Buffer
  const derived = scryptSync(password, toU8(salt), 64) // Buffer
  return `scrypt$${b64urlFromBuffer(salt)}$${b64urlFromBuffer(derived)}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 3) return false
  if (parts[0] !== 'scrypt') return false

  const salt = b64urlToBuffer(parts[1])
  const expected = b64urlToBuffer(parts[2])

  const derived = scryptSync(password, toU8(salt), expected.length) // Buffer
  return constantTimeEqual(toU8(expected), toU8(derived))
}

export function generateResetToken(): string {
  return b64urlFromBuffer(randomBytes(32))
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
