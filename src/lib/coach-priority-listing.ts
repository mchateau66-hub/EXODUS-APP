import { prisma } from "@/lib/db"
import { FEATURE_KEYS } from "@/domain/billing/features"

/**
 * Coachs (user_id) ayant l’entitlement `coach.priority_listing` actif — requête bulk, pas de N+1.
 */
export async function getPriorityCoachIds(coachUserIds: string[], now: Date = new Date()): Promise<Set<string>> {
  if (coachUserIds.length === 0) {
    return new Set()
  }
  try {
    const rows = await prisma.userEntitlement.findMany({
      where: {
        user_id: { in: coachUserIds },
        feature_key: FEATURE_KEYS.coachPriorityListing,
        starts_at: { lte: now },
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
      select: { user_id: true },
    })
    return new Set(rows.map((r) => String(r.user_id)))
  } catch (e) {
    console.warn("coach_priority_listing_read_failed", { error: String(e) })
    return new Set()
  }
}

/**
 * Bucket stable : prioritaires d’abord, puis le reste ; ordre relatif inchangé dans chaque groupe.
 */
export function prioritizeCoachResults<T extends { userId: string }>(
  items: T[],
  priorityCoachIds: Set<string>,
): T[] {
  const priority: T[] = []
  const standard: T[] = []
  for (const item of items) {
    if (priorityCoachIds.has(item.userId)) {
      priority.push(item)
    } else {
      standard.push(item)
    }
  }
  return [...priority, ...standard]
}
