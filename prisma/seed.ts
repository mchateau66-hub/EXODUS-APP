import "dotenv/config"
import { seedPlansFeatures } from "./seed.plans_features"
import { runSeedE2eAdminPaginationUsers } from "./seed.e2e_admin_pagination"

async function main() {
  await seedPlansFeatures()
  await runSeedE2eAdminPaginationUsers()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
