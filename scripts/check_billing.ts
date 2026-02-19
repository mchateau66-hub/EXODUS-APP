// scripts/check-billing.ts
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

/**
 * Load env for local runs (CI provides env already).
 * If DATABASE_URL already exists, we do nothing.
 */
function loadEnvIfMissing() {
  if (process.env.DATABASE_URL) return;

  const cwd = process.cwd();
  const candidates = [".env.local", ".env.development.local", ".env"];

  for (const file of candidates) {
    const full = path.join(cwd, file);
    if (fs.existsSync(full)) {
      dotenv.config({ path: full });
      console.log(`[env] loaded ${file}`);
      return;
    }
  }

  console.warn("[env] no env file found (DATABASE_URL still missing)");
}

function fail(msg: string): never {
  console.error(`[billing-integrity] ❌ ${msg}`);
  process.exit(1);
}

async function main() {
  loadEnvIfMissing();

  if (!process.env.DATABASE_URL) {
    fail("Missing DATABASE_URL. Run with dotenv or add .env.local");
  }

  const prisma = new PrismaClient();

  try {
    // 1) Basic connectivity
    await prisma.$queryRaw`SELECT 1`;

    // 2) Billing integrity: subscriptions must have billing set
    const missing = await prisma.subscription.count({
      where: { billing: null },
    });

    if (missing > 0) {
      fail(`Found ${missing} subscription(s) with billing=NULL`);
    }

    console.log("[billing-integrity] ✅ OK");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[billing-integrity] ❌ unexpected error:", e);
  process.exit(1);
});
