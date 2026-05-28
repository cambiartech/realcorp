import { DealStage, LeadQuality } from "../../src/generated/prisma";
import { sha256Hex } from "../../src/lib/portal-token";
import { daysAgo } from "./helpers";
import type { DemoSeedContext } from "./types";

const COMMUNITY_PARTNERS = [
  {
    key: "elite",
    displayName: "Elite Realty Partners",
    email: "partners@eliterealty.demo",
    company: "Elite Realty",
    territory: "Lagos Island",
    portalToken: "demo-community-elite-bopropertiesng",
  },
  {
    key: "connect",
    displayName: "Lagos Connect Agents",
    email: "hello@lagosconnect.demo",
    company: "Lagos Connect",
    territory: "Lekki & Ajah",
    portalToken: "demo-community-connect-bopropertiesng",
  },
  {
    key: "abuja-net",
    displayName: "Abuja Property Network",
    email: "team@abujanet.demo",
    company: "APN",
    territory: "Abuja FCT",
    portalToken: "demo-community-abuja-bopropertiesng",
  },
  {
    key: "referral-circle",
    displayName: "Referral Circle NG",
    email: "referrals@circle.demo",
    company: "Referral Circle",
    territory: "Nationwide",
    portalToken: "demo-community-referrals-bopropertiesng",
  },
] as const;

export async function seedCommunity(ctx: DemoSeedContext) {
  const { prisma, tenantId, users } = ctx;
  console.log("  [community] partners, portal links, prospects & referrals…");

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  if (!tenant) return;

  const project =
    (await prisma.project.findFirst({ where: { tenantId }, orderBy: { name: "asc" } })) ??
    (await prisma.project.findFirst({ where: { tenantId } }));
  const projectName = project?.name ?? "The Azure — Lekki";

  const partnerRecords = [];
  for (const row of COMMUNITY_PARTNERS) {
    const id = `${tenantId}-community-${row.key}`;
    const partner = await prisma.realtorPartner.upsert({
      where: { id },
      create: {
        id,
        tenantId,
        displayName: row.displayName,
        email: row.email,
        company: row.company,
        territory: row.territory,
        isActive: true,
        portalTokenHash: sha256Hex(row.portalToken),
        notes: "Demo community member — portal link seeded for leaderboard walkthrough.",
      },
      update: {
        displayName: row.displayName,
        portalTokenHash: sha256Hex(row.portalToken),
        isActive: true,
      },
    });
    partnerRecords.push({ ...partner, portalToken: row.portalToken });
  }

  const leadFixtures: Array<{
    partnerKey: string;
    name: string;
    email: string;
    source: string;
    quality: LeadQuality;
    daysAgo: number;
    winDeal?: boolean;
  }> = [
    { partnerKey: "elite", name: "Tunde Adeyemi", email: "tunde.community@demo.ng", source: "Community: Elite Realty Partners", quality: LeadQuality.HOT, daysAgo: 3, winDeal: true },
    { partnerKey: "elite", name: "Zainab Musa", email: "zainab.community@demo.ng", source: "Community: Elite Realty Partners", quality: LeadQuality.WARM, daysAgo: 8 },
    { partnerKey: "connect", name: "James Okafor", email: "james.community@demo.ng", source: "Community: Lagos Connect Agents", quality: LeadQuality.HOT, daysAgo: 2 },
    { partnerKey: "connect", name: "Adaora Nwosu", email: "adaora.community@demo.ng", source: "Community: Lagos Connect Agents", quality: LeadQuality.WARM, daysAgo: 12 },
    { partnerKey: "connect", name: "Samuel Ade", email: "samuel.community@demo.ng", source: "Community: Lagos Connect Agents", quality: LeadQuality.HOT, daysAgo: 18, winDeal: true },
    { partnerKey: "abuja-net", name: "Fatima Bello", email: "fatima.community@demo.ng", source: "Community: Abuja Property Network", quality: LeadQuality.WARM, daysAgo: 5 },
    { partnerKey: "referral-circle", name: "Chidi Eze", email: "chidi.referral@demo.ng", source: "Referral", quality: LeadQuality.HOT, daysAgo: 4 },
    { partnerKey: "referral-circle", name: "Blessing Udo", email: "blessing.referral@demo.ng", source: "Referral", quality: LeadQuality.WARM, daysAgo: 14 },
    { partnerKey: "referral-circle", name: "Yusuf Ibrahim", email: "yusuf.referral@demo.ng", source: "Referral", quality: LeadQuality.HOT, daysAgo: 22, winDeal: true },
  ];

  for (const row of leadFixtures) {
    const partner = partnerRecords.find((p) => p.id.endsWith(`-${row.partnerKey}`));
    if (!partner) continue;

    const leadId = `${tenantId}-community-lead-${row.email}`;
    const createdAt = daysAgo(row.daysAgo);
    const lead = await prisma.lead.upsert({
      where: { id: leadId },
      create: {
        id: leadId,
        tenantId,
        assignedUserId: users.salesUser.id,
        realtorPartnerId: partner.id,
        source: row.source,
        projectInterest: projectName,
        quality: row.quality,
        score: row.quality === LeadQuality.HOT ? 85 : row.quality === LeadQuality.WARM ? 55 : 25,
        name: row.name,
        email: row.email,
        phone: "+234 803 000 0000",
        createdAt,
        lastActivityAt: createdAt,
      },
      update: {
        realtorPartnerId: partner.id,
        source: row.source,
        quality: row.quality,
        createdAt,
      },
    });

    if (row.winDeal) {
      const dealId = `${tenantId}-community-deal-${row.email}`;
      await prisma.deal.upsert({
        where: { id: dealId },
        create: {
          id: dealId,
          tenantId,
          leadId: lead.id,
          assignedUserId: users.salesUser.id,
          stage: DealStage.CLOSED_WON,
          value: row.quality === LeadQuality.HOT ? "92000000" : "68000000",
          updatedAt: daysAgo(Math.max(0, row.daysAgo - 1)),
        },
        update: {
          stage: DealStage.CLOSED_WON,
          updatedAt: daysAgo(Math.max(0, row.daysAgo - 1)),
        },
      });
    }
  }

  const elite = partnerRecords[0];
  if (elite) {
    console.log(
      `    Demo community portal: /realtor/${tenant.slug}/${elite.id}?a=${elite.portalToken}`,
    );
  }
}
