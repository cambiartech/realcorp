import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  TenantStatus,
  TenantPlan,
  MembershipRole,
  MembershipStatus,
} from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { runDemoDataPack } from "./demo-seed";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL is required for seeding");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const BO_SLUG = "bopropertiesng";

async function main() {
  const platformPassword = process.env.SEED_PLATFORM_PASSWORD ?? "Pass@123";
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "Pass@40123";
  const orgAdminBoPassword = process.env.SEED_ORG_ADMIN_BO_PASSWORD ?? "Pass@123";

  const platformHash = await bcrypt.hash(platformPassword, 12);
  const demoHash = await bcrypt.hash(demoPassword, 12);
  const orgAdminBoHash = await bcrypt.hash(orgAdminBoPassword, 12);

  await prisma.user.upsert({
    where: { email: "admin@realcorp.com" },
    create: {
      email: "admin@realcorp.com",
      name: "Platform Admin",
      passwordHash: platformHash,
      isPlatformAdmin: true,
      emailVerified: new Date(),
    },
    update: {
      passwordHash: platformHash,
      isPlatformAdmin: true,
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: BO_SLUG },
    create: {
      name: "Bo Properties Nigeria",
      slug: BO_SLUG,
      status: TenantStatus.ACTIVE,
      plan: TenantPlan.GROWTH,
      defaultCurrency: "NGN",
      defaultTimezone: "Africa/Lagos",
    },
    update: {
      name: "Bo Properties Nigeria",
      status: TenantStatus.ACTIVE,
    },
  });

  await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      monthlyRevenueTarget: "250000000",
      pipelineTarget: "500000000",
      moduleHr: true,
      moduleShortLets: true,
      moduleSales: true,
      moduleFinance: true,
      moduleMarketing: true,
      moduleCommunity: true,
      moduleFacility: true,
    },
    update: {
      monthlyRevenueTarget: "250000000",
      pipelineTarget: "500000000",
      moduleHr: true,
      moduleShortLets: true,
      moduleFacility: true,
    },
  });

  const orgAdmin = await prisma.user.upsert({
    where: { email: "dev@bopropertiesng.com" },
    create: {
      email: "dev@bopropertiesng.com",
      name: "Bo Properties — Org Admin",
      passwordHash: orgAdminBoHash,
      emailVerified: new Date(),
    },
    update: {
      passwordHash: orgAdminBoHash,
      name: "Bo Properties — Org Admin",
    },
  });

  const salesUser = await prisma.user.upsert({
    where: { email: "dev+1@bopropertiesng.com" },
    create: {
      email: "dev+1@bopropertiesng.com",
      name: "Amaka Okonkwo",
      passwordHash: demoHash,
      emailVerified: new Date(),
    },
    update: {
      passwordHash: demoHash,
      name: "Amaka Okonkwo",
    },
  });

  const financeUser = await prisma.user.upsert({
    where: { email: "finance@bopropertiesng.com" },
    create: {
      email: "finance@bopropertiesng.com",
      name: "Finance Lead",
      passwordHash: demoHash,
      emailVerified: new Date(),
    },
    update: { passwordHash: demoHash },
  });

  const hrUser = await prisma.user.upsert({
    where: { email: "hr@bopropertiesng.com" },
    create: {
      email: "hr@bopropertiesng.com",
      name: "Chioma Nwachukwu",
      passwordHash: demoHash,
      emailVerified: new Date(),
    },
    update: { passwordHash: demoHash, name: "Chioma Nwachukwu" },
  });

  const memberships: Array<{ userId: string; role: MembershipRole }> = [
    { userId: orgAdmin.id, role: MembershipRole.ORG_ADMIN },
    { userId: salesUser.id, role: MembershipRole.SALES_EXECUTIVE },
    { userId: financeUser.id, role: MembershipRole.FINANCE_MANAGER },
    { userId: hrUser.id, role: MembershipRole.HR_MANAGER },
  ];

  for (const m of memberships) {
    await prisma.membership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: m.userId } },
      create: {
        tenantId: tenant.id,
        userId: m.userId,
        role: m.role,
        status: MembershipStatus.ACTIVE,
      },
      update: { role: m.role, status: MembershipStatus.ACTIVE },
    });
  }

  const fyStart = new Date("2026-01-01T00:00:00.000Z");
  const fyEnd = new Date("2026-12-31T23:59:59.999Z");
  await prisma.tenantGoal.deleteMany({ where: { tenantId: tenant.id, label: "FY 2026 (demo)" } });
  await prisma.tenantGoal.create({
    data: {
      tenantId: tenant.id,
      label: "FY 2026 (demo)",
      fiscalYearStart: fyStart,
      fiscalYearEnd: fyEnd,
      revenueTarget: "1200000000",
      pipelineTarget: "2000000000",
      isActive: true,
    },
  });

  await runDemoDataPack(prisma, tenant.id, {
    orgAdmin: { id: orgAdmin.id, name: orgAdmin.name, email: orgAdmin.email! },
    salesUser: { id: salesUser.id, name: salesUser.name, email: salesUser.email! },
    financeUser: { id: financeUser.id, name: financeUser.name, email: financeUser.email! },
    hrUser: { id: hrUser.id, name: hrUser.name, email: hrUser.email! },
  });

  console.log("Seed OK.");
  try {
    const { syncNigeriaLocationsFromSource } = await import("../src/lib/nigeria-locations-sync");
    const geo = await syncNigeriaLocationsFromSource(false);
    console.log(`Nigeria locations: ${geo.states} states, ${geo.lgas} LGAs synced.`);
  } catch (err) {
    console.warn("Nigeria locations sync skipped (run npm run db:sync-locations):", err);
  }
  console.log("");
  console.log("Platform admin: admin@realcorp.com");
  console.log(`Bo Properties tenant: /${BO_SLUG}`);
  console.log("  dev@bopropertiesng.com (org admin)");
  console.log("  dev+1@bopropertiesng.com (sales)");
  console.log("  finance@bopropertiesng.com (finance)");
  console.log("  hr@bopropertiesng.com (people / HR)");
  console.log("");
  console.log(
    "Passwords: SEED_PLATFORM_PASSWORD, SEED_ORG_ADMIN_BO_PASSWORD, SEED_DEMO_PASSWORD (local defaults Pass@123 / Pass@40123).",
  );
  console.log("Re-apply demo fixtures: delete campaign DEMO_PACK_V2, then npm run db:seed");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
