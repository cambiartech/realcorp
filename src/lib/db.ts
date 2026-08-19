import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function createPool() {
  // Runtime MUST use the pooled URL (Supabase :6543 ?pgbouncer=true).
  // DIRECT_URL is for migrations only — using it here exhausts Postgres max_connections
  // under Netlify serverless (many parallel function invocations).
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set (pooled connection required for runtime).");
  }

  const max = Number(process.env.PG_POOL_MAX ?? 1);

  return new Pool({
    connectionString,
    max: Number.isFinite(max) && max > 0 ? max : 1,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });
}

function createPrisma(pool: Pool) {
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

/** Dev hot-reload keeps a global Prisma singleton; refresh if schema/client drift after `prisma generate`. */
function isStaleDevClient(client: PrismaClient) {
  if (process.env.NODE_ENV === "production") return false;
  const probe = client as PrismaClient & {
    financeDocument?: { findMany?: unknown };
    inventoryItem?: { findMany?: unknown };
  };
  return (
    typeof probe.financeDocument?.findMany !== "function" ||
    typeof probe.inventoryItem?.findMany !== "function"
  );
}

function getPrismaClient() {
  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = createPool();
  }
  const pool = globalForPrisma.pgPool;

  const cached = globalForPrisma.prisma;
  if (cached && !isStaleDevClient(cached)) return cached;

  if (cached) {
    void cached.$disconnect().catch(() => undefined);
  }

  const client = createPrisma(pool);
  globalForPrisma.prisma = client;
  return client;
}

export const prisma = getPrismaClient();

export default prisma;
