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

function resolveDbUrl(): string {
  const rawDb0 = stripWrappingQuotes(process.env.DATABASE_URL ?? "");
  const rawDirect0 = stripWrappingQuotes(process.env.DIRECT_URL ?? "");

  let db = rawDb0;

  // Supporte les patterns fréquents dans .env :
  // DATABASE_URL="$DIRECT_URL" ou DATABASE_URL="${DIRECT_URL}"
  if (db === "$DIRECT_URL" || db === "${DIRECT_URL}" || db === "DIRECT_URL") {
    db = rawDirect0;
  }

  // Fallback : si DATABASE_URL vide mais DIRECT_URL dispo
  if (!db && rawDirect0) db = rawDirect0;

  // Sécurité : parfois la valeur contient encore des espaces / retours
  db = (db ?? "").trim();

  // Validation minimale (Prisma exige postgres:// ou postgresql://)
  if (!/^postgres(ql)?:\/\//i.test(db)) {
    const hint =
      `[db] Invalid DATABASE_URL.\n` +
      `- DATABASE_URL(raw)="${String(process.env.DATABASE_URL ?? "").slice(0, 120)}"\n` +
      `- DIRECT_URL(raw)="${String(process.env.DIRECT_URL ?? "").slice(0, 120)}"\n\n` +
      `Fix:\n` +
      `- Mets une vraie URL dans DATABASE_URL (pas "$DIRECT_URL"), ou\n` +
      `- Laisse DATABASE_URL vide et définis DIRECT_URL, ou\n` +
      `- Assure-toi que DATABASE_URL ne commence pas par un guillemet.\n`;
    throw new Error(hint);
  }

  // Optionnel : debug léger sans leak complet
  if ((process.env.DEBUG_DB_URL ?? "").trim() === "1") {
    const safePrefix = db.slice(0, 32);
    console.log(`[db] Using DATABASE_URL prefix="${safePrefix}" len=${db.length}`);
  }

  return db;
}

const dbUrl = resolveDbUrl();

// Important: passer l’URL via `datasources` évite tous les soucis de parsing
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: dbUrl },
    },
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
