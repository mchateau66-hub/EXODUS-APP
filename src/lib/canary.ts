// src/lib/canary.ts
import crypto from 'node:crypto'

export function inCanary(userId: string | null | undefined, percent: number): boolean {
  if (!userId) return false
  const p = Math.max(0, Math.min(100, percent))
  const h = crypto.createHash('sha256').update(userId).digest()
  const bucket = h[0] // 0..255
  return bucket < Math.floor((p / 100) * 256)
}