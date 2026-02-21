// src/lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function stripWrappingQuotes(input: string): string {
  const s = (input ?? "").trim();
  if (!s) return "";
  const first = s[0];
  const last = s[s.length - 1];
  if ((first === `"` && last === `"`) || (first === `'` && last === `'`)) {
    return s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Résout DATABASE_URL de manière robuste.
 * IMPORTANT: Ne throw pas au build : retourne "" si invalide/absent.
 */
function resolveDbUrlSafe(): string {
  const rawDb0 = stripWrappingQuotes(process.env.DATABASE_URL ?? "");
  const rawDirect0 = stripWrappingQuotes(process.env.DIRECT_URL ?? "");

  let db = rawDb0;

  // Supporte patterns fréquents:
  // DATABASE_URL="$DIRECT_URL" ou DATABASE_URL="${DIRECT_URL}" ou "DIRECT_URL"
  if (db === "$DIRECT_URL" || db === "${DIRECT_URL}" || db === "DIRECT_URL") {
    db = rawDirect0;
  }

  // Fallback : si DATABASE_URL vide mais DIRECT_URL dispo
  if (!db && rawDirect0) db = rawDirect0;

  db = (db ?? "").trim();
  if (!db) return "";

  // Validation minimale (Prisma exige postgres:// ou postgresql://)
  if (!/^postgres(ql)?:\/\//i.test(db)) {
    // On ne throw pas ici pour ne pas casser le build Vercel.
    // On log uniquement si DEBUG_DB_URL=1
    if ((process.env.DEBUG_DB_URL ?? "").trim() === "1") {
      const hint =
        `[db] Invalid DATABASE_URL.\n` +
        `- DATABASE_URL(raw)="${String(process.env.DATABASE_URL ?? "").slice(0, 120)}"\n` +
        `- DIRECT_URL(raw)="${String(process.env.DIRECT_URL ?? "").slice(0, 120)}"\n` +
        `Fix:\n` +
        `- Mets une vraie URL dans DATABASE_URL (pas "$DIRECT_URL"), ou\n` +
        `- Laisse DATABASE_URL vide et définis DIRECT_URL, ou\n` +
        `- Assure-toi que DATABASE_URL ne commence pas par un guillemet.\n`;
      console.warn(hint);
    }
    return "";
  }

  // Optionnel : debug léger sans leak complet
  if ((process.env.DEBUG_DB_URL ?? "").trim() === "1") {
    const safePrefix = db.slice(0, 32);
    console.log(`[db] Using DATABASE_URL prefix="${safePrefix}" len=${db.length}`);
  }

  return db;
}

/**
 * Lazy Prisma accessor:
 * - ne casse pas le build si DATABASE_URL/DIRECT_URL est absent ou invalide
 * - retourne null si DB non configurée (Preview, build, etc.)
 */
export function getPrisma(): PrismaClient | null {
  const dbUrl = resolveDbUrlSafe();
  if (!dbUrl) return null;

  // Singleton en dev (Next hot reload)
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
  }
  return globalForPrisma.prisma;
}

/**
 * Compat: si une partie du code importe encore `prisma`,
 * on l’expose mais SANS instancier au build.
 * ⚠️ À terme, préfère importer getPrisma() partout.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    if (!client) {
      throw new Error(
        "[db] Prisma client unavailable (DATABASE_URL/DIRECT_URL missing or invalid)."
      );
    }
    // @ts-expect-error dynamic proxy
    return client[prop];
  },
}) as PrismaClient;