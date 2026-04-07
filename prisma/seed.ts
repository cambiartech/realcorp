import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  TenantStatus,
  TenantPlan,
  MembershipRole,
  MembershipStatus,
  DealStage,
  UnitStatus,
  LeadQuality,
  InvoiceStatus,
  CampaignStatus,
} from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

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
  /** Bo Properties org admin (`dev@bopropertiesng.com`) — default matches common local demo expectation */
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
    },
    update: {
      monthlyRevenueTarget: "250000000",
      pipelineTarget: "500000000",
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
    update: {
      passwordHash: demoHash,
    },
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: orgAdmin.id } },
    create: {
      tenantId: tenant.id,
      userId: orgAdmin.id,
      role: MembershipRole.ORG_ADMIN,
      status: MembershipStatus.ACTIVE,
    },
    update: { role: MembershipRole.ORG_ADMIN, status: MembershipStatus.ACTIVE },
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: salesUser.id } },
    create: {
      tenantId: tenant.id,
      userId: salesUser.id,
      role: MembershipRole.SALES_EXECUTIVE,
      status: MembershipStatus.ACTIVE,
    },
    update: { role: MembershipRole.SALES_EXECUTIVE, status: MembershipStatus.ACTIVE },
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: financeUser.id } },
    create: {
      tenantId: tenant.id,
      userId: financeUser.id,
      role: MembershipRole.FINANCE_MANAGER,
      status: MembershipStatus.ACTIVE,
    },
    update: { role: MembershipRole.FINANCE_MANAGER, status: MembershipStatus.ACTIVE },
  });

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

  const demoPack = await prisma.campaign.findFirst({
    where: { tenantId: tenant.id, code: "LAGOS_Q1" },
    select: { id: true },
  });
  if (demoPack) {
    console.log("Seed OK — Bo Properties demo pack already applied (campaign LAGOS_Q1). Skipping CRM fixture recreate.");
    console.log("  To fully reset demo data, use a fresh DB or delete the LAGOS_Q1 campaign and related rows.");
    console.log("");
    console.log("Platform admin: admin@realcorp.com");
    console.log(`Bo Properties (${BO_SLUG}):`);
    console.log("  dev@bopropertiesng.com (org admin: SEED_ORG_ADMIN_BO_PASSWORD or default Pass@123)");
    console.log("  dev+1@bopropertiesng.com, finance@bopropertiesng.com — SEED_DEMO_PASSWORD or default Pass@40123");
    return;
  }

  const campaign = await prisma.campaign.create({
    data: {
      tenantId: tenant.id,
      name: "Lagos Q1 Push",
      code: "LAGOS_Q1",
      status: CampaignStatus.ACTIVE,
      description: "Paid social + search — demo attribution",
    },
  });

  const partner = await prisma.realtorPartner.create({
    data: {
      tenantId: tenant.id,
      displayName: "Elite Realty Partners",
      email: "partners@eliterealty.demo",
      company: "Elite Realty",
      territory: "Lagos Island",
      isActive: true,
    },
  });

  const projectAzure = await prisma.project.create({
    data: {
      tenantId: tenant.id,
      name: "The Azure — Lekki",
      basePrice: "85000000",
      currency: "NGN",
    },
  });

  const projectPalm = await prisma.project.create({
    data: {
      tenantId: tenant.id,
      name: "Palm Heights — Abuja",
      basePrice: "62000000",
      currency: "NGN",
    },
  });

  const planAzure = await prisma.projectPricingPlan.create({
    data: {
      tenantId: tenant.id,
      projectId: projectAzure.id,
      name: "3-Bed Premium",
      price: "92000000",
      currency: "NGN",
      initialDeposit: "15000000",
      paymentDurationMonths: 18,
      billingCadence: "monthly",
    },
  });

  const planPalm = await prisma.projectPricingPlan.create({
    data: {
      tenantId: tenant.id,
      projectId: projectPalm.id,
      name: "2-Bed Executive",
      price: "68000000",
      currency: "NGN",
      initialDeposit: "10000000",
      paymentDurationMonths: 24,
      billingCadence: "monthly",
    },
  });

  const unitsAzure = await prisma.$transaction([
    prisma.unit.create({
      data: {
        tenantId: tenant.id,
        projectId: projectAzure.id,
        pricingPlanId: planAzure.id,
        label: "Azure A-12",
        unitType: "3BR",
        status: UnitStatus.AVAILABLE,
      },
    }),
    prisma.unit.create({
      data: {
        tenantId: tenant.id,
        projectId: projectAzure.id,
        pricingPlanId: planAzure.id,
        label: "Azure B-04",
        unitType: "3BR",
        status: UnitStatus.RESERVED,
      },
    }),
    prisma.unit.create({
      data: {
        tenantId: tenant.id,
        projectId: projectAzure.id,
        pricingPlanId: planAzure.id,
        label: "Azure C-21",
        unitType: "3BR",
        status: UnitStatus.SOLD,
      },
    }),
  ]);

  const unitPalm1 = await prisma.unit.create({
    data: {
      tenantId: tenant.id,
      projectId: projectPalm.id,
      pricingPlanId: planPalm.id,
      label: "Palm P-07",
      unitType: "2BR",
      status: UnitStatus.AVAILABLE,
    },
  });

  const leads = await prisma.$transaction([
    prisma.lead.create({
      data: {
        tenantId: tenant.id,
        assignedUserId: salesUser.id,
        source: "Instagram",
        campaignId: campaign.id,
        campaignName: campaign.name,
        utmSource: "instagram",
        utmMedium: "paid",
        utmCampaign: "LAGOS_Q1",
        projectInterest: projectAzure.name,
        quality: LeadQuality.HOT,
        name: "Chidi Eze",
        email: "chidi.eze@example.com",
        phone: "+234 801 000 0001",
      },
    }),
    prisma.lead.create({
      data: {
        tenantId: tenant.id,
        assignedUserId: salesUser.id,
        source: "Referral",
        realtorPartnerId: partner.id,
        projectInterest: projectPalm.name,
        quality: LeadQuality.WARM,
        name: "Fatima Bello",
        email: "fatima.bello@example.com",
        phone: "+234 802 000 0002",
      },
    }),
    prisma.lead.create({
      data: {
        tenantId: tenant.id,
        assignedUserId: orgAdmin.id,
        source: "Website",
        projectInterest: projectAzure.name,
        quality: LeadQuality.COLD,
        name: "James Okafor",
        email: "j.okafor@example.com",
      },
    }),
  ]);

  const dealReserved = await prisma.deal.create({
    data: {
      tenantId: tenant.id,
      leadId: leads[0].id,
      unitId: unitsAzure[1].id,
      assignedUserId: salesUser.id,
      stage: DealStage.RESERVATION_MADE,
      value: "92000000",
      pendingFinance: true,
    },
  });

  await prisma.deal.create({
    data: {
      tenantId: tenant.id,
      leadId: leads[1].id,
      unitId: unitPalm1.id,
      assignedUserId: salesUser.id,
      stage: DealStage.NEGOTIATION,
      value: "68000000",
      pendingFinance: false,
    },
  });

  await prisma.deal.create({
    data: {
      tenantId: tenant.id,
      leadId: leads[2].id,
      assignedUserId: orgAdmin.id,
      stage: DealStage.QUALIFIED,
      value: "85000000",
      pendingFinance: false,
    },
  });

  const invCount = await prisma.invoice.count({ where: { tenantId: tenant.id } });
  const invNum1 = `INV-${String(invCount + 1).padStart(5, "0")}`;
  const invNum2 = `INV-${String(invCount + 2).padStart(5, "0")}`;

  const inv1 = await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      dealId: dealReserved.id,
      invoiceNumber: invNum1,
      title: "Reservation deposit — Azure B-04",
      status: InvoiceStatus.PARTIALLY_PAID,
      amount: "15000000",
      balanceDue: "5000000",
      currency: "NGN",
      dueDate: new Date(Date.now() + 14 * 86_400_000),
      createdByUserId: financeUser.id,
      createdByLabel: financeUser.name,
    },
  });

  await prisma.paymentRecord.create({
    data: {
      tenantId: tenant.id,
      invoiceId: inv1.id,
      amount: "10000000",
      currency: "NGN",
      paidAt: new Date(),
      method: "Bank transfer",
      reference: "GTB-DEMO-001",
      recordedByUserId: financeUser.id,
      recordedByLabel: financeUser.name,
    },
  });

  await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      invoiceNumber: invNum2,
      title: "Professional fees — staging",
      status: InvoiceStatus.SENT,
      amount: "2500000",
      balanceDue: "2500000",
      currency: "NGN",
      dueDate: new Date(Date.now() - 10 * 86_400_000),
      createdByUserId: financeUser.id,
      createdByLabel: financeUser.name,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      actorUserId: orgAdmin.id,
      actorLabel: orgAdmin.name,
      module: "FINANCE",
      entityType: "INVOICE",
      entityId: inv1.id,
      action: "CREATE",
      summary: "Demo seed: invoice created for CEO walkthrough.",
    },
  });

  console.log("Seed OK.");
  console.log("");
  console.log("Platform admin: admin@realcorp.com");
  console.log(`Bo Properties tenant: /${BO_SLUG}`);
  console.log("  dev@bopropertiesng.com (org admin)");
  console.log("  dev+1@bopropertiesng.com (sales)");
  console.log("  finance@bopropertiesng.com (finance)");
  console.log("");
  console.log(
    "Use SEED_PLATFORM_PASSWORD, SEED_ORG_ADMIN_BO_PASSWORD, SEED_DEMO_PASSWORD in production; defaults are for local demo only.",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
