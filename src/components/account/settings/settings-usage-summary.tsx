import {
  SettingsFactRow,
  SettingsFactsList,
  SettingsInfoBox,
} from "@/components/account/settings/settings-section"

export type SettingsUsageSummaryProps = {
  messagesSentToday: number | null
  messagesSentTotal: number | null
  messageDailyLimit: number | null
  messagesRemainingToday: number | null
  hasUnlimitedMessages: boolean
  coachProfileViews: number | null
  searchResultViews: number | null
  contactUnlocks: number | null
  dailyResetMode: "utc"
}

function displayValue(n: number | null): string {
  if (n === null) return "Non disponible"
  return String(n)
}

function displayDailyLimit(limit: number | null, hasUnlimitedMessages: boolean): string {
  if (hasUnlimitedMessages) return "Illimitée"
  if (limit === null) return "Non définie"
  return String(limit)
}

function displayRemaining(remaining: number | null, hasUnlimitedMessages: boolean): string {
  if (hasUnlimitedMessages) return "Illimités"
  if (remaining === null) return "Non disponible"
  return String(remaining)
}

/**
 * Compteurs d’usage serveur — lecture seule, sans quota ni progression.
 */
export function SettingsUsageSummary({
  messagesSentToday,
  messagesSentTotal,
  messageDailyLimit,
  messagesRemainingToday,
  hasUnlimitedMessages,
  coachProfileViews,
  searchResultViews,
  contactUnlocks,
  dailyResetMode,
}: SettingsUsageSummaryProps) {
  const showUtcNote = dailyResetMode === "utc"

  return (
    <>
      <SettingsFactsList>
        <SettingsFactRow label="Messages envoyés aujourd’hui" value={displayValue(messagesSentToday)} />
        <SettingsFactRow label="Messages envoyés au total" value={displayValue(messagesSentTotal)} />
        <SettingsFactRow
          label="Limite quotidienne de messages"
          value={displayDailyLimit(messageDailyLimit, hasUnlimitedMessages)}
        />
        <SettingsFactRow
          label="Messages restants aujourd’hui"
          value={displayRemaining(messagesRemainingToday, hasUnlimitedMessages)}
        />
        <SettingsFactRow label="Profils coach consultés" value={displayValue(coachProfileViews)} />
        <SettingsFactRow label="Résultats de recherche consultés" value={displayValue(searchResultViews)} />
        <SettingsFactRow label="Contacts débloqués" value={displayValue(contactUnlocks)} />
      </SettingsFactsList>
      {showUtcNote ? (
        <SettingsInfoBox>
          Le compteur quotidien est réinitialisé sur une base calendaire UTC.
          <br />
          La limite quotidienne de messages, lorsqu’elle est définie, s’applique à ce compteur.
          <br />
          Certains abonnements peuvent lever cette limite quotidienne.
        </SettingsInfoBox>
      ) : null}
    </>
  )
}
