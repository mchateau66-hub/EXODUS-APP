/**
 * Usage tracking V1 — compteurs agrégés côté serveur (mesure uniquement, pas d’enforcement).
 *
 * Hypothèse « journée » pour `messages_sent_today` : **jour calendaire UTC**
 * (comparaison `YYYY-MM-DD` sur `daily_reset_at` vs maintenant). Pas de fuseau utilisateur en V1.
 */

import { prisma } from "@/lib/db"

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function logTech(event: string, meta: Record<string, unknown>) {
  console.error(`[${event}]`, meta)
}

export async function ensureUsageCounter(userId: string): Promise<void> {
  try {
    await prisma.userUsageCounter.upsert({
      where: { user_id: userId },
      create: { user_id: userId },
      update: {},
    })
  } catch (e) {
    logTech("usage_counter_create_failed", { userId, error: String(e) })
  }
}

/**
 * Remet `messages_sent_today` à 0 si on a changé de jour UTC depuis `daily_reset_at`.
 * Retourne la ligne à jour (ou null si échec lecture).
 */
async function maybeResetDailyMessagesSent(userId: string): Promise<{ messages_sent_today: number; daily_reset_at: Date | null } | null> {
  const now = new Date()
  try {
    await ensureUsageCounter(userId)
    const row = await prisma.userUsageCounter.findUnique({
      where: { user_id: userId },
      select: { messages_sent_today: true, daily_reset_at: true },
    })
    if (!row) return null

    const needReset = !row.daily_reset_at || utcDayKey(row.daily_reset_at) !== utcDayKey(now)
    if (!needReset) {
      return { messages_sent_today: row.messages_sent_today, daily_reset_at: row.daily_reset_at }
    }

    const updated = await prisma.userUsageCounter.update({
      where: { user_id: userId },
      data: {
        messages_sent_today: 0,
        daily_reset_at: now,
      },
      select: { messages_sent_today: true, daily_reset_at: true },
    })
    return updated
  } catch (e) {
    logTech("usage_counter_daily_reset_failed", { userId, error: String(e) })
    return null
  }
}

export async function trackMessageSent(userId: string): Promise<void> {
  const now = new Date()
  try {
    await prisma.$transaction(async (tx) => {
      const row = await tx.userUsageCounter.findUnique({
        where: { user_id: userId },
        select: { messages_sent_today: true, daily_reset_at: true },
      })
      if (!row) {
        await tx.userUsageCounter.create({
          data: {
            user_id: userId,
            messages_sent_today: 1,
            messages_sent_total: 1,
            daily_reset_at: now,
          },
        })
        return
      }

      const needReset = !row.daily_reset_at || utcDayKey(row.daily_reset_at) !== utcDayKey(now)
      const today = needReset ? 0 : row.messages_sent_today

      await tx.userUsageCounter.update({
        where: { user_id: userId },
        data: {
          messages_sent_today: today + 1,
          messages_sent_total: { increment: 1 },
          ...(needReset ? { daily_reset_at: now } : {}),
        },
      })
    })
  } catch (e) {
    logTech("usage_counter_increment_failed", { userId, op: "trackMessageSent", error: String(e) })
  }
}

async function incrementCounter(
  userId: string,
  field: "coach_profile_views" | "search_result_views" | "contact_unlocks",
  delta: number,
): Promise<void> {
  if (delta <= 0) return
  try {
    await prisma.userUsageCounter.upsert({
      where: { user_id: userId },
      create: { user_id: userId, [field]: delta },
      update: { [field]: { increment: delta } },
    })
  } catch (e) {
    logTech("usage_counter_increment_failed", { userId, op: field, error: String(e) })
  }
}

export async function trackCoachProfileView(userId: string): Promise<void> {
  await incrementCounter(userId, "coach_profile_views", 1)
}

export async function trackSearchResultView(userId: string, count = 1): Promise<void> {
  const delta = Math.max(1, Math.floor(count))
  await incrementCounter(userId, "search_result_views", delta)
}

export async function trackContactUnlock(userId: string): Promise<void> {
  await incrementCounter(userId, "contact_unlocks", 1)
}

/** Exposé pour tests / admin — même logique que lecture des compteurs (reset `messages_sent_today` si jour UTC changé). */
export async function maybeResetDailyCounters(userId: string): Promise<void> {
  await maybeResetDailyMessagesSent(userId)
}

export async function getUsageCounters(userId: string) {
  await maybeResetDailyCounters(userId)
  await ensureUsageCounter(userId)
  const row = await prisma.userUsageCounter.findUnique({
    where: { user_id: userId },
  })
  if (!row) return null
  return {
    messages_sent_today: row.messages_sent_today,
    messages_sent_total: row.messages_sent_total,
    coach_profile_views: row.coach_profile_views,
    search_result_views: row.search_result_views,
    contact_unlocks: row.contact_unlocks,
    daily_reset_at: row.daily_reset_at,
  }
}
