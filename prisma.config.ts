import { defineConfig } from "prisma/config";
import { config } from "dotenv";
import path from "node:path";

// charge .env.local (et fallback sur .env si besoin)
config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
});