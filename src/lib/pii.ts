// src/lib/pii.ts

// --------------------
// Patterns (client-side)
// --------------------

// Emails type a@b.com
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

// Numéros FR type 06 12 34 56 78 ou +33 6 12 34 56 78 (assez strict)
const PHONE_FR = /(\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}\b/g;

// Numéros plus “laxes” (fallback) : +XX... ou suites longues de digits séparés
// (évite de laisser passer des formats non FR)
const PHONE_GENERIC = /(\+?\d[\d .\-()]{6,}\d)/g;

// URLs + domaines fréquents + www.
const URL =
  /((?:https?:\/\/|www\.)\S+|\b[a-z0-9.-]+\.(?:com|fr|net|io|gg|me|org|app|co|live|tv)\S*)/gi;

// Handles @xxx
const AT_HANDLE = /(^|\s)@([a-z0-9_.-]{3,})\b/gi;

// Discord pseudo#1234
const DISCORD_TAG = /\b([a-z0-9_.]{3,})#\d{4}\b/gi;

// Détection “mots sociaux” + contexte (ex: "instagram: @toto")
const SOCIAL_WORDS =
  "(?:instagram|insta|ig|snapchat|snap|facebook|fb|tiktok|tt|telegram|signal|whatsapp|wa|discord|dc|linkedin|x|twitter|reddit|messenger|skype)";
const HANDLE_CONTEXT_WORDS = "(?:pseudo|identifiant|username|user|handle|profil|compte|contact|id)";
const SOCIAL_CONTEXT = new RegExp(`\\b${SOCIAL_WORDS}\\b([^\\n\\r]{0,50})`, "gi");
const HANDLE_CONTEXT = new RegExp(`\\b${HANDLE_CONTEXT_WORDS}\\b([^\\n\\r]{0,50})`, "gi");

// --------------------
// Helpers
// --------------------

function maskSameLength(s: string) {
  // garde la longueur (évite d’exposer des fragments)
  return s.replace(/./g, "•");
}

function maskHandleInContext(full: string, contextPart: string): string {
  const ctx = String(contextPart ?? "");
  const handleMatch = ctx.match(/@?[a-z0-9_.-]{3,}/i);
  if (!handleMatch) return full;
  const handle = handleMatch[0];
  // On remplace uniquement le handle détecté
  return full.replace(handle, "[pseudo masqué]");
}

/**
 * Masque les infos perso si canReveal === false.
 * - Free → canReveal = false → tout est masqué côté client AVANT envoi
 * - messages.unlimited / plan payant → canReveal = true → on laisse le texte inchangé
 */
export function maskPII(input: string, canReveal: boolean): string {
  if (!input) return "";
  if (canReveal) return input;

  const trimmed = input.trim();

  // Si le message est “juste un pseudo” (évite les contournements)
  if (/^[a-z0-9][a-z0-9_.-]{4,}[a-z0-9]$/i.test(trimmed)) {
    return "[pseudo masqué]";
  }

  let out = input;

  // Emails / phones / urls
  out = out.replace(EMAIL, "[email masqué]");
  out = out.replace(PHONE_FR, "[téléphone masqué]");
  out = out.replace(URL, "[lien masqué]");

  // Fallback phone (après PHONE_FR pour ne pas double-masquer)
  out = out.replace(PHONE_GENERIC, "[téléphone masqué]");

  // Contexte social / handle
  out = out.replace(SOCIAL_CONTEXT, (full, ctx) => maskHandleInContext(full, ctx));
  out = out.replace(HANDLE_CONTEXT, (full, ctx) => maskHandleInContext(full, ctx));

  // @handles
  out = out.replace(AT_HANDLE, (_full, space) => `${space}[pseudo masqué]`);

  // Discord tags
  out = out.replace(DISCORD_TAG, "[pseudo masqué]");

  // “tokens/pseudos” suspects (longs, mélange chiffres/symboles)
  out = out.replace(/\b(?=[a-z0-9_.-]*[_\d.])[a-z0-9_.-]{5,}\b/gi, "[pseudo masqué]");
  out = out.replace(/\b[a-z0-9]{11,}\b/gi, "[pseudo masqué]");

  // Dernier filet: si quelqu’un a tenté de contourner avec des masques de longueur
  // (optionnel, mais garde une couche de sécurité)
  // out = out.replace(EMAIL, (m) => maskSameLength(m));
  // out = out.replace(PHONE_FR, (m) => maskSameLength(m));

  return out;
}
