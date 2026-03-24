import { prisma } from "@/lib/db"
import { getUsageCounters } from "@/lib/usage-tracking"

/** Clé d’entitlement paramétrable (valeur numérique dans `meta`). */
export const MESSAGE_DAILY_LIMIT_FEATURE_KEY = "messages.daily_limit"

export type MessageDailyLimitCheck =
  | {
      allowed: true
      limit: number | null
      usedToday: number | null
    }
  | {
      allowed: false
      reason: "daily_limit_reached" | "usage_unavailable"
      limit: number | null
      usedToday: number | null
    }

export function parseDailyLimit(raw: unknown): number | null {
  if (raw == null) return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.floor(value)
}

function extractLimitRawFromMeta(meta: unknown): unknown {
  if (meta == null) return null
  if (typeof meta === "number") return meta
  if (typeof meta === "object" && meta !== null) {
    const m = meta as Record<string, unknown>
    return m.limit ?? m.daily_limit ?? m.value ?? m.dailyLimit
  }
  return null
}

async function readDailyLimitFromEntitlements(userId: string, now: Date): Promise<{
  hasRow: boolean
  rawExtracted: unknown
}> {
  try {
    const row = await prisma.userEntitlement.findFirst({
      where: {
        user_id: userId,
        feature_key: MESSAGE_DAILY_LIMIT_FEATURE_KEY,
        starts_at: { lte: now },
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
      orderBy: { starts_at: "desc" },
      select: { meta: true },
    })
    if (!row) return { hasRow: false, rawExtracted: undefined }
    const rawExtracted = extractLimitRawFromMeta(row.meta)
    return { hasRow: true, rawExtracted }
  } catch {
    return { hasRow: false, rawExtracted: undefined }
  }
}

/**
 * Option A : enforcement strict si une limite quotidienne valide est définie via `messages.daily_limit`.
 * Sans limite valide : laisse passer (comportement inchangé).
 */
export async function checkMessageDailyLimit(userId: string, now = new Date()): Promise<MessageDailyLimitCheck> {
  const { hasRow, rawExtracted } = await readDailyLimitFromEntitlements(userId, now)

  if (!hasRow) {
    return { allowed: true, limit: null, usedToday: null }
  }

  if (rawExtracted == null) {
    return { allowed: true, limit: null, usedToday: null }
  }

  const limit = parseDailyLimit(rawExtracted)
  if (limit == null) {
    console.warn("message_daily_limit_invalid_entitlement", {
      userId,
      raw: rawExtracted,
    })
    return { allowed: true, limit: null, usedToday: null }
  }

  const usage = await getUsageCounters(userId)
  if (usage == null) {
    console.warn("message_daily_limit_usage_unavailable", {
      userId,
      limit,
    })
    return {
      allowed: false,
      reason: "usage_unavailable",
      limit,
      usedToday: null,
    }
  }

  const usedToday = usage.messages_sent_today

  if (usedToday >= limit) {
    console.warn("message_daily_limit_reached", {
      userId,
      limit,
      usedToday,
    })
    return {
      allowed: false,
      reason: "daily_limit_reached",
      limit,
      usedToday,
    }
  }

  return { allowed: true, limit, usedToday }
}

/** Corps JSON pour HTTP 429 (contrat Option A). */
export function messageDailyLimit429Body(params: {
  reason: "daily_limit_reached" | "usage_unavailable"
  limit: number | null
  usedToday: number | null
}): {
  error: string
  code: "daily_limit_reached" | "usage_unavailable"
  limit: number | null
  usedToday: number | null
} {
  const { reason, limit, usedToday } = params
  return {
    error:
      reason === "daily_limit_reached"
        ? "Limite quotidienne de messages atteinte."
        : "Impossible de vérifier votre quota de messages pour le moment.",
    code: reason,
    limit,
    usedToday,
  }
}
