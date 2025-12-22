// src/lib/messages/sanitize.ts

// Email classique : toto@mail.com
const EMAIL_REGEX =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi

// Numéros de téléphone (format FR + général) : +33 6..., 06-12-34-56-78, etc.
const PHONE_REGEX =
  /(\+?\d[\d .\-()]{6,}\d)/g

// Réseaux sociaux : "instagram: @monpseudo", "insta @mon_pseudo", "fb: pseudo42", etc.
const SOCIAL_CONTEXT_REGEX =
  /\b(?:instagram|insta|ig|snapchat|snap|facebook|fb|tiktok|tt|telegram|signal|whatsapp|wa)\b([^\n\r]{0,40})/gi

export function sanitizeMessageForFreePlan(raw: string): string {
  if (!raw) return raw
  let text = raw

  // 1) Email → [email masqué]
  text = text.replace(EMAIL_REGEX, '[email masqué]')

  // 2) Téléphone → [téléphone masqué]
  text = text.replace(PHONE_REGEX, '[téléphone masqué]')

  // 3) Pseudos réseaux sociaux dans un contexte "instagram / fb / insta / snap..."
  text = text.replace(SOCIAL_CONTEXT_REGEX, (full, contextPart) => {
    // On cherche un handle du type @mon_pseudo ou mon.pseudo
    const handleMatch = String(contextPart ?? '').match(
      /@?[a-z0-9_.]{3,}/i,
    )

    if (!handleMatch) return full

    const handle = handleMatch[0]
    // On remplace juste le pseudo, on garde le reste du texte
    return full.replace(handle, '[pseudo masqué]')
  })

  return text
}
