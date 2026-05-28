import type { PrismaClient } from "../../src/generated/prisma";
import { seedCommunity } from "./community";
import { seedFinance } from "./finance";
import { demoPackAlreadyApplied, markDemoPackApplied } from "./helpers";
import { seedPeople } from "./people";
import { seedSales } from "./sales";
import { seedTasks } from "./tasks";
import { seedShortlets } from "./shortlets";
import type { DemoUsers } from "./types";

export async function runDemoDataPack(prisma: PrismaClient, tenantId: string, users: DemoUsers) {
  if (await demoPackAlreadyApplied(prisma, tenantId)) {
    console.log("Demo pack v2 already applied — skipping (campaign DEMO_PACK_V2 exists).");
    console.log("  To re-run: delete campaign with code DEMO_PACK_V2, then npm run db:seed");
    return;
  }

  console.log("Applying demo data pack v2…");
  const ctx = { prisma, tenantId, users };

  const sales = await seedSales(ctx);
  await seedFinance(ctx, sales);
  await seedCommunity(ctx);
  await seedPeople(ctx);
  await seedTasks(ctx);
  await seedShortlets(ctx, sales);

  await markDemoPackApplied(prisma, tenantId);
  console.log("Demo pack v2 applied.");
}
