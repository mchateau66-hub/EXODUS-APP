'use client'

import { useMemo, useState } from 'react'
import CoachConversationCardClient from '@/components/coach/CoachConversationCardClient'

type CoachAthleteStatus = 'LEAD' | 'ACTIVE' | 'TO_FOLLOW' | 'ENDED'

export type ConversationItem = {
  href: string
  athleteId: string
  coachSlug: string

  userLabel: string
  objectiveSummary: string | null
  goalType: string | null

  lastMessageAtIso: string
  lastMessageContent: string
  messageCount: number

  status: CoachAthleteStatus | null
  pinned: boolean
  labels: string[]
  nextFollowUpAtIso: string | null
}

type Props = {
  initialItems: ConversationItem[]
  statusFilter?: CoachAthleteStatus | null
  q?: string
}

function matchesFilters(
  item: ConversationItem,
  statusFilter: CoachAthleteStatus | null,
  q: string,
) {
  if (statusFilter && item.status !== statusFilter) return false

  const query = q.trim().toLowerCase()
  if (!query) return true

  const haystack = [
    item.userLabel,
    item.objectiveSummary ?? '',
    item.goalType ?? '',
    (item.labels ?? []).join(' '),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function sortItems(items: ConversationItem[]) {
  return items.slice().sort((a, b) => {
    // 1) pinned d'abord
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1

    // 2) nextFollowUpAt (si présent) : le plus proche d'abord
    const ta = a.nextFollowUpAtIso ? new Date(a.nextFollowUpAtIso).getTime() : Number.POSITIVE_INFINITY
    const tb = b.nextFollowUpAtIso ? new Date(b.nextFollowUpAtIso).getTime() : Number.POSITIVE_INFINITY
    if (ta !== tb) return ta - tb

    // 3) dernier message
    const ma = new Date(a.lastMessageAtIso).getTime()
    const mb = new Date(b.lastMessageAtIso).getTime()
    return mb - ma
  })
}

export default function CoachConversationListClient({
  initialItems,
  statusFilter = null,
  q = '',
}: Props) {
  const [items, setItems] = useState<ConversationItem[]>(() =>
    sortItems(initialItems),
  )

  function applyUpdate(
    athleteId: string,
    patch: Partial<
      Pick<
        ConversationItem,
        'status' | 'pinned' | 'labels' | 'nextFollowUpAtIso'
      >
    >,
  ) {
    setItems((prev) => {
      const next = prev.map((it) => {
        if (it.athleteId !== athleteId) return it
        return {
          ...it,
          ...patch,
          labels: patch.labels ?? it.labels,
          nextFollowUpAtIso:
            patch.nextFollowUpAtIso !== undefined
              ? patch.nextFollowUpAtIso
              : it.nextFollowUpAtIso,
        }
      })
      return sortItems(next)
    })
  }

  const visibleItems = useMemo(() => {
    const sorted = sortItems(items)
    return sorted.filter((it) => matchesFilters(it, statusFilter, q))
  }, [items, statusFilter, q])

  return (
    <div className="space-y-3">
      {visibleItems.map((item) => (
        <CoachConversationCardClient
          key={item.athleteId}
          item={item}
          onUpdate={(patch) => applyUpdate(item.athleteId, patch)}
        />
      ))}
    </div>
  )
}
