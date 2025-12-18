// src/lib/pii.ts

// Emails type a@b.com
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi

// Numéros FR type 06 12 34 56 78 ou +33 6 12 34 56 78
const PHONE_FR = /(\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}\b/g

/**
 * Masque les infos perso (email/téléphone) si canReveal === false.
 * - Free → canReveal = false → tout est masqué côté client AVANT envoi
 * - messages.unlimited → canReveal = true → on laisse le texte inchangé
 */
export function maskPII(input: string, canReveal: boolean): string {
  if (!input) return ''
  if (canReveal) return input

  const mask = (s: string) => s.replace(/./g, '•')

  let out = input.replace(EMAIL, (m) => mask(m))
  out = out.replace(PHONE_FR, (m) => mask(m))

  return out
}
