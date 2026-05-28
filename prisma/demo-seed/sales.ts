import {
  ActivityStatus,
  ActivityType,
  CampaignStatus,
  DealStage,
  LeadQuality,
} from "../../src/generated/prisma";
import { daysAgo } from "./helpers";
import type { DemoSeedContext, SalesSeedRefs } from "./types";

const LEAD_FIXTURES = [
  { email: "chidi.eze@demo.boproperties.ng", name: "Chidi Eze", source: "Instagram", quality: LeadQuality.HOT, project: "azure" },
  { email: "fatima.bello@demo.boproperties.ng", name: "Fatima Bello", source: "Referral", quality: LeadQuality.WARM, project: "palm" },
  { email: "j.okafor@demo.boproperties.ng", name: "James Okafor", source: "Website", quality: LeadQuality.COLD, project: "azure" },
  { email: "adaora.nwosu@demo.boproperties.ng", name: "Adaora Nwosu", source: "Google Ads", quality: LeadQuality.HOT, project: "azure" },
  { email: "tunde.adeyemi@demo.boproperties.ng", name: "Tunde Adeyemi", source: "Walk-in", quality: LeadQuality.WARM, project: "palm" },
  { email: "zainab.musa@demo.boproperties.ng", name: "Zainab Musa", source: "LinkedIn", quality: LeadQuality.WARM, project: "azure" },
  { email: "emeka.duru@demo.boproperties.ng", name: "Emeka Duru", source: "Billboard", quality: LeadQuality.COLD, project: "palm" },
  { email: "grace.adebayo@demo.boproperties.ng", name: "Grace Adebayo", source: "Instagram", quality: LeadQuality.HOT, project: "azure" },
  { email: "yusuf.ibrahim@demo.boproperties.ng", name: "Yusuf Ibrahim", source: "Referral", quality: LeadQuality.WARM, project: "palm" },
  { email: "nneka.obi@demo.boproperties.ng", name: "Nneka Obi", source: "Website", quality: LeadQuality.COLD, project: "azure" },
  { email: "samuel.ade@demo.boproperties.ng", name: "Samuel Ade", source: "Facebook", quality: LeadQuality.HOT, project: "palm" },
  { email: "blessing.udo@demo.boproperties.ng", name: "Blessing Udo", source: "WhatsApp", quality: LeadQuality.WARM, project: "azure" },
] as const;

export async function seedSales(ctx: DemoSeedContext): Promise<SalesSeedRefs> {
  const { prisma, tenantId, users } = ctx;
  console.log("  [sales] campaigns, projects, leads, deals, activities…");

  const campaignLagos = await prisma.campaign.upsert({
    where: { tenantId_code: { tenantId, code: "LAGOS_Q1" } },
    create: {
      tenantId,
      name: "Lagos Q1 Push",
      code: "LAGOS_Q1",
      status: CampaignStatus.ACTIVE,
      description: "Paid social + search — demo attribution",
    },
    update: { status: CampaignStatus.ACTIVE },
  });

  const campaignAbuja = await prisma.campaign.upsert({
    where: { tenantId_code: { tenantId, code: "ABUJA_LAUNCH" } },
    create: {
      tenantId,
      name: "Abuja Launch 2026",
      code: "ABUJA_LAUNCH",
      status: CampaignStatus.ACTIVE,
      description: "Billboards + realtor partners",
    },
    update: {},
  });

  const partner = await prisma.realtorPartner.upsert({
    where: { id: `${tenantId}-elite-realty` },
    create: {
      id: `${tenantId}-elite-realty`,
      tenantId,
      displayName: "Elite Realty Partners",
      email: "partners@eliterealty.demo",
      company: "Elite Realty",
      territory: "Lagos Island",
      isActive: true,
    },
    update: {},
  }).catch(async () => {
    const existing = await prisma.realtorPartner.findFirst({
      where: { tenantId, email: "partners@eliterealty.demo" },
    });
    if (existing) return existing;
    return prisma.realtorPartner.create({
      data: {
        tenantId,
        displayName: "Elite Realty Partners",
        email: "partners@eliterealty.demo",
        company: "Elite Realty",
        territory: "Lagos Island",
        isActive: true,
      },
    });
  });

  const projectAzure = await prisma.project.upsert({
    where: { id: `${tenantId}-project-azure` },
    create: {
      id: `${tenantId}-project-azure`,
      tenantId,
      name: "The Azure — Lekki",
      basePrice: "85000000",
      currency: "NGN",
    },
    update: {},
  }).catch(async () => {
    const p = await prisma.project.findFirst({ where: { tenantId, name: "The Azure — Lekki" } });
    if (!p) throw new Error("Azure project missing");
    return p;
  });

  const projectPalm = await prisma.project.upsert({
    where: { id: `${tenantId}-project-palm` },
    create: {
      id: `${tenantId}-project-palm`,
      tenantId,
      name: "Palm Heights — Abuja",
      basePrice: "62000000",
      currency: "NGN",
    },
    update: {},
  }).catch(async () => {
    const p = await prisma.project.findFirst({ where: { tenantId, name: "Palm Heights — Abuja" } });
    if (!p) throw new Error("Palm project missing");
    return p;
  });

  const planAzure = await prisma.projectPricingPlan.findFirst({
    where: { tenantId, projectId: projectAzure.id, name: "3-Bed Premium" },
  }).then(
    (p) =>
      p ??
      prisma.projectPricingPlan.create({
        data: {
          tenantId,
          projectId: projectAzure.id,
          name: "3-Bed Premium",
          price: "92000000",
          currency: "NGN",
          initialDeposit: "15000000",
          paymentDurationMonths: 18,
          billingCadence: "monthly",
        },
      }),
  );

  const planPalm = await prisma.projectPricingPlan.findFirst({
    where: { tenantId, projectId: projectPalm.id, name: "2-Bed Executive" },
  }).then(
    (p) =>
      p ??
      prisma.projectPricingPlan.create({
        data: {
          tenantId,
          projectId: projectPalm.id,
          name: "2-Bed Executive",
          price: "68000000",
          currency: "NGN",
          initialDeposit: "10000000",
          paymentDurationMonths: 24,
          billingCadence: "monthly",
        },
      }),
  );

  const unitLabelsAzure = ["Azure A-12", "Azure B-04", "Azure C-21", "Azure D-08", "Azure E-15"];
  const unitsAzure = [];
  for (let i = 0; i < unitLabelsAzure.length; i += 1) {
    const label = unitLabelsAzure[i];
    const existing = await prisma.unit.findFirst({ where: { tenantId, projectId: projectAzure.id, label } });
    const status =
      i === 0 ? "AVAILABLE" : i === 1 ? "RESERVED" : i === 2 ? "SOLD" : i === 3 ? "AVAILABLE" : "RESERVED";
    const u =
      existing ??
      (await prisma.unit.create({
        data: {
          tenantId,
          projectId: projectAzure.id,
          pricingPlanId: planAzure.id,
          label,
          unitType: "3BR",
          status: status as "AVAILABLE" | "RESERVED" | "SOLD",
        },
      }));
    unitsAzure.push({ id: u.id, label });
  }

  const unitPalmExisting = await prisma.unit.findFirst({
    where: { tenantId, projectId: projectPalm.id, label: "Palm P-07" },
  });
  const unitPalm =
    unitPalmExisting ??
    (await prisma.unit.create({
      data: {
        tenantId,
        projectId: projectPalm.id,
        pricingPlanId: planPalm.id,
        label: "Palm P-07",
        unitType: "2BR",
        status: "AVAILABLE",
      },
    }));

  const palmP02 =
    (await prisma.unit.findFirst({ where: { tenantId, label: "Palm P-02" } })) ??
    (await prisma.unit.create({
      data: {
        tenantId,
        projectId: projectPalm.id,
        pricingPlanId: planPalm.id,
        label: "Palm P-02",
        unitType: "2BR",
        status: "AVAILABLE",
      },
    }));

  const leads = [];
  for (const row of LEAD_FIXTURES) {
    const projectName = row.project === "azure" ? projectAzure.name : projectPalm.name;
    const lead = await prisma.lead.upsert({
      where: { id: `${tenantId}-lead-${row.email}` },
      create: {
        id: `${tenantId}-lead-${row.email}`,
        tenantId,
        assignedUserId: users.salesUser.id,
        source: row.source,
        campaignId: row.project === "azure" ? campaignLagos.id : campaignAbuja.id,
        campaignName: row.project === "azure" ? campaignLagos.name : campaignAbuja.name,
        realtorPartnerId: row.source === "Referral" ? partner.id : undefined,
        projectInterest: projectName,
        quality: row.quality,
        score: row.quality === LeadQuality.HOT ? 85 : row.quality === LeadQuality.WARM ? 55 : 25,
        name: row.name,
        email: row.email,
        phone: `+234 80${Math.floor(Math.random() * 9)} ${Math.floor(100 + Math.random() * 899)} ${Math.floor(1000 + Math.random() * 8999)}`,
        lastActivityAt: daysAgo(Math.floor(Math.random() * 14)),
      },
      update: { quality: row.quality, score: row.quality === LeadQuality.HOT ? 85 : 55 },
    });
    leads.push({ id: lead.id });
  }

  const deals = [];
  const dealSpecs = [
    { leadIdx: 0, unitId: unitsAzure[1].id, stage: DealStage.RESERVATION_MADE, value: "92000000", pending: true },
    { leadIdx: 1, unitId: unitPalm.id, stage: DealStage.NEGOTIATION, value: "68000000", pending: false },
    { leadIdx: 2, unitId: null, stage: DealStage.QUALIFIED, value: "85000000", pending: false },
    { leadIdx: 3, unitId: unitsAzure[0].id, stage: DealStage.INSPECTION_BOOKED, value: "92000000", pending: false },
    { leadIdx: 4, unitId: palmP02.id, stage: DealStage.CONTACTED, value: "68000000", pending: false },
    { leadIdx: 5, unitId: unitsAzure[3].id, stage: DealStage.NEGOTIATION, value: "92000000", pending: true },
    { leadIdx: 6, unitId: null, stage: DealStage.NEW_LEAD, value: "62000000", pending: false },
    { leadIdx: 7, unitId: unitsAzure[2].id, stage: DealStage.CLOSED_WON, value: "92000000", pending: false },
    { leadIdx: 8, unitId: null, stage: DealStage.CLOSED_LOST, value: "68000000", pending: false },
  ];

  for (let i = 0; i < dealSpecs.length; i += 1) {
    const spec = dealSpecs[i];
    const dealId = `${tenantId}-deal-${i + 1}`;
    if (spec.unitId) {
      await prisma.deal.updateMany({
        where: { tenantId, unitId: spec.unitId, id: { not: dealId } },
        data: { unitId: null },
      });
    }
    const deal = await prisma.deal.upsert({
      where: { id: dealId },
      create: {
        id: dealId,
        tenantId,
        leadId: leads[spec.leadIdx].id,
        unitId: spec.unitId,
        assignedUserId: users.salesUser.id,
        stage: spec.stage,
        value: spec.value,
        pendingFinance: spec.pending,
      },
      update: { stage: spec.stage, pendingFinance: spec.pending },
    });
    deals.push({ id: deal.id });
  }

  for (let i = 0; i < Math.min(6, leads.length); i += 1) {
    const activityId = `${tenantId}-activity-lead-${i}`;
    await prisma.activity.upsert({
      where: { id: activityId },
      create: {
        id: activityId,
        tenantId,
        entityType: "LEAD",
        entityId: leads[i].id,
        type: i % 2 === 0 ? ActivityType.CALL : ActivityType.WHATSAPP,
        status: ActivityStatus.DONE,
        title: i % 2 === 0 ? "Follow-up call — pricing discussion" : "Sent brochure on WhatsApp",
        body: "Demo activity for pipeline walkthrough.",
        completedAt: daysAgo(i + 1),
        createdByUserId: users.salesUser.id,
        assignedUserId: users.salesUser.id,
      },
      update: {},
    });
  }

  return {
    campaignLagos,
    campaignAbuja,
    projectAzure: { id: projectAzure.id, name: projectAzure.name },
    projectPalm: { id: projectPalm.id, name: projectPalm.name },
    unitsAzure,
    unitPalm: { id: unitPalm.id, label: unitPalm.label },
    leads,
    deals,
  };
}
