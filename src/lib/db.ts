import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrisma() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/** Dev hot-reload keeps a global Prisma singleton; refresh if schema/client drift after `prisma generate`. */
function isStaleDevClient(client: PrismaClient) {
  if (process.env.NODE_ENV === "production") return false;
  const probe = client as PrismaClient & { financeDocument?: { findMany?: unknown } };
  return typeof probe.financeDocument?.findMany !== "function";
}

function getPrismaClient() {
  const cached = globalForPrisma.prisma;
  if (cached && !isStaleDevClient(cached)) return cached;

  if (cached) {
    void cached.$disconnect().catch(() => undefined);
  }

  const client = createPrisma();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

export const prisma = getPrismaClient();

export default prisma;
