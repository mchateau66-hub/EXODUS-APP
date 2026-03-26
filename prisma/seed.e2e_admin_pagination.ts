/**
 * Utilisateurs dédiés aux tests E2E admin `/admin/users` (pagination multi-page).
 * Activé uniquement si `E2E_SEED_ADMIN_USERS_PAGINATION=1` (CI e2e-smoke-local, ou local avant `pnpm run e2e:admin`).
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/** Nombre strictement supérieur à ADMIN_USER_SEARCH_TAKE (20) pour forcer au moins 2 pages. */
export const E2E_ADMIN_PAGINATION_USER_COUNT = 22

export async function seedE2eAdminPaginationUsers() {
  if (process.env.E2E_SEED_ADMIN_USERS_PAGINATION !== "1") {
    console.log(
      "[seed] skip e2e admin pagination users (E2E_SEED_ADMIN_USERS_PAGINATION!=1 — pour les données E2E admin : pnpm db:seed:e2e:admin)",
    )
    return
  }

  for (let i = 0; i < E2E_ADMIN_PAGINATION_USER_COUNT; i++) {
    const email = `e2e-pagination-${String(i).padStart(2, "0")}@exodus-e2e.local`
    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        role: "athlete",
        status: "active",
        onboardingStep: 3,
        name: `E2E Pagination ${i}`,
      },
      update: {
        role: "athlete",
        status: "active",
        onboardingStep: 3,
      },
    })
  }

  console.log(`✅ e2e admin pagination users seeded (${E2E_ADMIN_PAGINATION_USER_COUNT})`)
}

export async function runSeedE2eAdminPaginationUsers() {
  try {
    await seedE2eAdminPaginationUsers()
  } finally {
    await prisma.$disconnect()
  }
}
