import "dotenv/config"
import { config as loadEnvFile } from "dotenv"
import { existsSync } from "node:fs"
import { seedPlansFeatures } from "./seed.plans_features"
import { runSeedE2eAdminPaginationUsers } from "./seed.e2e_admin_pagination"

// Prisma CLI + prisma.config ne chargent pas toujours .env.local ; Next.js oui — aligner le seed local.
if (existsSync(".env.local")) {
  loadEnvFile({ path: ".env.local", override: true })
}

function requireDatabaseUrl(): void {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error(
      "[seed] DATABASE_URL est absent ou vide. Définis-le dans .env ou .env.local (voir .env.example), puis relance pnpm db:seed ou pnpm db:seed:e2e:admin.",
    )
    process.exit(1)
  }
}

async function main() {
  requireDatabaseUrl()
  await seedPlansFeatures()
  await runSeedE2eAdminPaginationUsers()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
