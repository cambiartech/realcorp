/**
 * Re-apply demo pack v2 without touching users/passwords.
 * Deletes marker campaign DEMO_PACK_V2 first, then runs the pack.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { runDemoDataPack } from "./demo-seed";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL required");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const BO_SLUG = "bopropertiesng";

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: BO_SLUG } });
  if (!tenant) throw new Error(`Tenant ${BO_SLUG} not found — run npm run db:seed first`);

  await prisma.campaign.deleteMany({ where: { tenantId: tenant.id, code: "DEMO_PACK_V2" } });

  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [
          "dev@bopropertiesng.com",
          "dev+1@bopropertiesng.com",
          "finance@bopropertiesng.com",
          "hr@bopropertiesng.com",
        ],
      },
    },
  });
  const byEmail = Object.fromEntries(users.map((u) => [u.email, u]));

  const orgAdmin = byEmail["dev@bopropertiesng.com"];
  const salesUser = byEmail["dev+1@bopropertiesng.com"];
  const financeUser = byEmail["finance@bopropertiesng.com"];
  let hrUser = byEmail["hr@bopropertiesng.com"];
  if (!orgAdmin || !salesUser || !financeUser) {
    throw new Error("Core demo users missing — run npm run db:seed first");
  }
  if (!hrUser) {
    hrUser = orgAdmin;
  }

  await runDemoDataPack(prisma, tenant.id, {
    orgAdmin: { id: orgAdmin.id, name: orgAdmin.name, email: orgAdmin.email! },
    salesUser: { id: salesUser.id, name: salesUser.name, email: salesUser.email! },
    financeUser: { id: financeUser.id, name: financeUser.name, email: financeUser.email! },
    hrUser: { id: hrUser.id, name: hrUser.name, email: hrUser.email! },
  });

  console.log("Demo pack re-applied.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
