'use client'

import Link from 'next/link'
import CoachAthleteQuickActionsClient from '@/components/coach/CoachAthleteQuickActionsClient'
import type { ConversationItem } from '@/components/coach/CoachConversationListClient'

type CoachAthleteStatus = 'LEAD' | 'ACTIVE' | 'TO_FOLLOW' | 'ENDED'

type Props = {
  item: ConversationItem
  onUpdate: (
    patch: Partial<
      Pick<ConversationItem, 'status' | 'pinned' | 'labels' | 'nextFollowUpAtIso'>
    >,
  ) => void
}

function formatDateTime(date: Date) {
  const day = date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
  const time = date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${day} · ${time}`
}

export default function CoachConversationCardClient({ item, onUpdate }: Props) {
  const lastMessageAt = new Date(item.lastMessageAtIso)

  return (
    <Link
      href={item.href}
      className="block rounded-2xl border border-transparent bg-white px-3 py-3 text-xs text-slate-700 shadow-sm transition hover:border-slate-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
              {item.userLabel.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1">
              <div className="text-[12px] font-semibold text-slate-900">
                {item.userLabel}
              </div>

              {item.status && (
                <div className="mt-0.5 inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                  {item.status}
                  {item.pinned && (
                    <span className="ml-1 text-[11px] text-amber-500">
                      • épinglé
                    </span>
                  )}
                </div>
              )}

              {item.objectiveSummary ? (
                <div className="text-[11px] text-slate-500 line-clamp-1">
                  Objectif : {item.objectiveSummary}
                </div>
              ) : item.goalType ? (
                <div className="text-[11px] text-slate-500">
                  Objectif : {item.goalType}
                </div>
              ) : (
                <div className="text-[11px] italic text-slate-400">
                  Aucun objectif détaillé renseigné pour l&apos;instant.
                </div>
              )}

              {item.labels.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.labels.map((label) => (
                    <span
                      key={label}
                      className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-1 rounded-xl bg-slate-50 px-2 py-1 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">
              Dernier message :
            </span>{' '}
            {item.lastMessageContent}
          </div>
        </div>

        <div className="flex flex-col items-end justify-between gap-2 text-right">
          <div className="text-[11px] text-slate-400">
            <div>{formatDateTime(lastMessageAt)}</div>
            <div>
              {item.messageCount} {item.messageCount > 1 ? 'messages' : 'message'}
            </div>
            {item.nextFollowUpAtIso && (
              <div className="mt-1 text-[10px] text-emerald-600">
                Relance le{' '}
                {formatDateTime(new Date(item.nextFollowUpAtIso)).split('·')[0]}
              </div>
            )}
          </div>

          <CoachAthleteQuickActionsClient
            athleteId={item.athleteId}
            coachSlug={item.coachSlug}
            initialPinned={item.pinned}
            initialStatus={item.status as CoachAthleteStatus | null}
            initialLabels={item.labels}
            initialNextFollowUpAt={item.nextFollowUpAtIso}
            refreshOnSuccess={false}
            onOptimisticUpdate={(u) => {
              if (typeof u.pinned === 'boolean') onUpdate({ pinned: u.pinned })
              if (u.status) onUpdate({ status: u.status })
              if (Array.isArray(u.labels)) onUpdate({ labels: u.labels })
              if ('nextFollowUpAt' in u)
                onUpdate({ nextFollowUpAtIso: u.nextFollowUpAt ?? null })
            }}
          />

          <span className="text-[11px] font-medium text-slate-600 underline underline-offset-2">
            Ouvrir la fiche
          </span>
        </div>
      </div>
    </Link>
  )
}
