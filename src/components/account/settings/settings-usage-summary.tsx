import {
  SettingsFactRow,
  SettingsFactsList,
  SettingsInfoBox,
} from "@/components/account/settings/settings-section"

export type SettingsUsageSummaryProps = {
  messagesSentToday: number | null
  messagesSentTotal: number | null
  coachProfileViews: number | null
  searchResultViews: number | null
  contactUnlocks: number | null
  dailyResetMode: "utc"
}

function displayValue(n: number | null): string {
  if (n === null) return "Non disponible"
  return String(n)
}

/**
 * Compteurs d’usage serveur — lecture seule, sans quota ni progression.
 */
export function SettingsUsageSummary({
  messagesSentToday,
  messagesSentTotal,
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
        <SettingsFactRow label="Profils coach consultés" value={displayValue(coachProfileViews)} />
        <SettingsFactRow label="Résultats de recherche consultés" value={displayValue(searchResultViews)} />
        <SettingsFactRow label="Contacts débloqués" value={displayValue(contactUnlocks)} />
      </SettingsFactsList>
      {showUtcNote ? (
        <SettingsInfoBox>
          Le compteur quotidien est réinitialisé sur une base calendaire UTC.
        </SettingsInfoBox>
      ) : null}
    </>
  )
}
