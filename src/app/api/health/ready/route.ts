// src/app/api/health/ready/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cache Prisma en dev pour éviter trop de connexions
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

type Component = { ok: boolean; detail?: string; [k: string]: any };

async function checkDb(): Promise<Component> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (e: any) {
    return { ok: false, detail: e?.message || "db query failed" };
  }
}

async function checkMigrations(): Promise<Component> {
  try {
    const rows = await prisma.$queryRaw<{ cnt: number }[]>`
      SELECT COUNT(*)::int AS cnt FROM "_prisma_migrations"
    `;
    const cnt = rows?.[0]?.cnt ?? 0;
    return { ok: cnt > 0, count: cnt };
  } catch (e: any) {
    // si la table n'existe pas encore
    return { ok: false, detail: e?.message || "migrations table missing" };
  }
}

async function checkEntitlementsView(): Promise<Component> {
  try {
    // IMPORTANT: ne PAS faire SELECT sur la vue, juste vérifier son existence
    const rows = await prisma.$queryRaw<any[]>`
      SELECT 1
      FROM information_schema.views
      WHERE table_name = 'user_effective_entitlements'
      LIMIT 1
    `;
    return { ok: (rows?.length ?? 0) > 0 };
  } catch (e: any) {
    return { ok: false, detail: e?.message || "view check failed" };
  }
}

function checkJwt(): Component {
  const missing: string[] = [];
  if (!process.env.ENTITLEMENTS_JWT_SECRET) missing.push("ENTITLEMENTS_JWT_SECRET");
  if (!process.env.SAT_JWT_SECRET) missing.push("SAT_JWT_SECRET");
  return missing.length ? { ok: false, detail: `missing ${missing.join(", ")}` } : { ok: true };
}

/**
 * Mode strict (prod/CI si vous voulez) :
 * - HEALTH_STRICT_READY=1 => /ready renvoie 503 si migrations/view/jwt KO
 * Mode non-strict (dev/e2e) :
 * - renvoie 200 si DB OK, même si view absente (status=degraded)
 */
export async function GET() {
  const started = Date.now();
  const strict = process.env.HEALTH_STRICT_READY === "1";

  const [db, migrations, entitlements_view, jwt] = await Promise.all([
    checkDb(),
    checkMigrations(),
    checkEntitlementsView(),
    Promise.resolve(checkJwt()),
  ]);

  const components = { db, migrations, entitlements_view, jwt };

  // "ok minimal" = DB doit répondre
  const okMinimal = db.ok;

  // "ok strict" = tous les composants doivent être ok
  const okStrict = Object.values(components).every((c) => c.ok);

  const ok = strict ? okStrict : okMinimal;

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      strict,
      components,
      durationMs: Date.now() - started,
      now: new Date().toISOString(),
      version: process.env.APP_VERSION ?? "dev",
    },
    { status: ok ? 200 : 503 }
  );
}
