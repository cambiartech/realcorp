import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma CLI does not automatically load Next.js .env.local.
loadEnv({ path: ".env.local" });
loadEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma Migrate should use a direct DB connection when available.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
