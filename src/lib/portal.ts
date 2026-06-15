import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { loadPublicListings, type PublicListing } from "@/lib/public-listings";

/**
 * Portfolio loader for the investor / listing-owner portal.
 *
 * Money flow: Project → Unit → Deal → Invoice → PaymentRecord, plus
 * SalesReceipts recorded directly against deals. A stakeholder's earnings are
 * their share of collections based on their allocation relative to all
 * allocations on that project (not a manually entered percentage).
 */

export type PortfolioPayment = {
  id: string;
  amount: number;
  currency: string;
  paidAt: string;
  label: string;
  projectName: string;
};

export type PortfolioProject = {
  projectId: string;
  projectName: string;
  currency: string;
  coverImageUrl: string | null;
  city: string | null;
  state: string | null;
  isPublished: boolean;
  stakeType: "INVESTOR" | "LISTING_OWNER";
  allocationAmount: number;
  totalProjectAllocation: number;
  unitsTotal: number;
  unitsSold: number;
  unitsReserved: number;
  unitsAvailable: number;
  totalInvoiced: number;
  totalCollected: number;
  outstanding: number;
  yourEarnings: number;
};

export type InvestorProjectDetail = PortfolioProject & {
  description: string | null;
  locationAddress: string | null;
  galleryUrls: string[];
  amenities: string[];
  payments: PortfolioPayment[];
};

export type StakeholderPortfolio = {
  projects: PortfolioProject[];
  totals: {
    currency: string;
    allocated: number;
    collected: number;
    earnings: number;
    projects: number;
  };
  recentPayments: PortfolioPayment[];
};

export async function loadStakeholderPortfolio(
  tenantId: string,
  userId: string,
): Promise<StakeholderPortfolio> {
  const stakes = await prisma.projectStakeholder.findMany({
    where: { tenantId, userId },
    select: {
      type: true,
      investmentAmount: true,
      project: {
        select: {
          id: true,
          name: true,
          currency: true,
          coverImageUrl: true,
          locationCity: true,
          locationState: true,
          isPublished: true,
          units: {
            select: {
              status: true,
              deal: { select: { id: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const projectIds = stakes.map((s) => s.project.id);
  const allProjectStakes =
    projectIds.length > 0
      ? await prisma.projectStakeholder.findMany({
          where: { tenantId, projectId: { in: projectIds } },
          select: { projectId: true, investmentAmount: true },
        })
      : [];

  const totalAllocationByProject = new Map<string, number>();
  for (const row of allProjectStakes) {
    const amount = row.investmentAmount != null ? Number(row.investmentAmount) : 0;
    if (amount <= 0) continue;
    totalAllocationByProject.set(
      row.projectId,
      (totalAllocationByProject.get(row.projectId) ?? 0) + amount,
    );
  }

  // Collect all deal ids across the stakeholder's projects, keep project mapping
  const dealToProject = new Map<string, string>();
  for (const stake of stakes) {
    for (const unit of stake.project.units) {
      if (unit.deal) dealToProject.set(unit.deal.id, stake.project.id);
    }
  }
  const dealIds = [...dealToProject.keys()];

  const [invoices, payments, receipts] = await Promise.all([
    dealIds.length
      ? prisma.invoice.findMany({
          where: { tenantId, dealId: { in: dealIds }, status: { not: "VOID" } },
          select: { id: true, dealId: true, amount: true },
        })
      : Promise.resolve([]),
    dealIds.length
      ? prisma.paymentRecord.findMany({
          where: { tenantId, invoice: { dealId: { in: dealIds } } },
          select: {
            id: true,
            amount: true,
            currency: true,
            paidAt: true,
            payerName: true,
            invoice: { select: { dealId: true, title: true } },
          },
          orderBy: { paidAt: "desc" },
        })
      : Promise.resolve([]),
    dealIds.length
      ? prisma.salesReceipt.findMany({
          where: { tenantId, dealId: { in: dealIds } },
          select: {
            id: true,
            dealId: true,
            amount: true,
            currency: true,
            issuedAt: true,
            title: true,
            customerName: true,
          },
          orderBy: { issuedAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  // Aggregate invoiced / collected per project
  const invoicedByProject = new Map<string, number>();
  for (const inv of invoices) {
    if (!inv.dealId) continue;
    const projectId = dealToProject.get(inv.dealId);
    if (!projectId) continue;
    invoicedByProject.set(projectId, (invoicedByProject.get(projectId) ?? 0) + Number(inv.amount));
  }

  const collectedByProject = new Map<string, number>();
  for (const pay of payments) {
    const dealId = pay.invoice?.dealId;
    if (!dealId) continue;
    const projectId = dealToProject.get(dealId);
    if (!projectId) continue;
    collectedByProject.set(projectId, (collectedByProject.get(projectId) ?? 0) + Number(pay.amount));
  }
  for (const receipt of receipts) {
    if (!receipt.dealId) continue;
    const projectId = dealToProject.get(receipt.dealId);
    if (!projectId) continue;
    collectedByProject.set(
      projectId,
      (collectedByProject.get(projectId) ?? 0) + Number(receipt.amount),
    );
  }

  const projectName = new Map(stakes.map((s) => [s.project.id, s.project.name]));

  const projects: PortfolioProject[] = stakes.map((stake) => {
    const p = stake.project;
    const allocationAmount =
      stake.investmentAmount != null ? Number(stake.investmentAmount) : 0;
    const totalProjectAllocation = totalAllocationByProject.get(p.id) ?? 0;
    const totalInvoiced = invoicedByProject.get(p.id) ?? 0;
    const totalCollected = collectedByProject.get(p.id) ?? 0;
    const yourEarnings =
      totalProjectAllocation > 0 && allocationAmount > 0
        ? (totalCollected * allocationAmount) / totalProjectAllocation
        : 0;
    return {
      projectId: p.id,
      projectName: p.name,
      currency: p.currency,
      coverImageUrl: p.coverImageUrl,
      city: p.locationCity,
      state: p.locationState,
      isPublished: p.isPublished,
      stakeType: stake.type,
      allocationAmount,
      totalProjectAllocation,
      unitsTotal: p.units.length,
      unitsSold: p.units.filter((u) => u.status === "SOLD").length,
      unitsReserved: p.units.filter((u) => u.status === "RESERVED").length,
      unitsAvailable: p.units.filter((u) => u.status === "AVAILABLE").length,
      totalInvoiced,
      totalCollected,
      outstanding: Math.max(totalInvoiced - totalCollected, 0),
      yourEarnings,
    };
  });

  const recentPayments: PortfolioPayment[] = [
    ...payments.map((pay) => ({
      id: pay.id,
      amount: Number(pay.amount),
      currency: pay.currency,
      paidAt: pay.paidAt.toISOString(),
      label: pay.invoice?.title || pay.payerName || "Payment",
      projectName: projectName.get(dealToProject.get(pay.invoice?.dealId ?? "") ?? "") ?? "",
    })),
    ...receipts.map((receipt) => ({
      id: receipt.id,
      amount: Number(receipt.amount),
      currency: receipt.currency,
      paidAt: receipt.issuedAt.toISOString(),
      label: receipt.title || receipt.customerName || "Sales receipt",
      projectName: projectName.get(dealToProject.get(receipt.dealId ?? "") ?? "") ?? "",
    })),
  ]
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
    .slice(0, 12);

  const currency = projects[0]?.currency ?? "NGN";
  return {
    projects,
    totals: {
      currency,
      allocated: projects.reduce((sum, p) => sum + p.allocationAmount, 0),
      collected: projects.reduce((sum, p) => sum + p.totalCollected, 0),
      earnings: projects.reduce((sum, p) => sum + p.yourEarnings, 0),
      projects: projects.length,
    },
    recentPayments,
  };
}

function jsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/** Single-project view for an investor's portfolio drill-down. */
export async function loadInvestorProjectDetail(
  tenantId: string,
  userId: string,
  projectId: string,
): Promise<InvestorProjectDetail | null> {
  const stake = await prisma.projectStakeholder.findFirst({
    where: { tenantId, userId, projectId },
    select: {
      type: true,
      investmentAmount: true,
      project: {
        select: {
          id: true,
          name: true,
          currency: true,
          coverImageUrl: true,
          locationCity: true,
          locationState: true,
          locationAddress: true,
          listingDescription: true,
          galleryUrls: true,
          amenities: true,
          isPublished: true,
          units: {
            select: {
              status: true,
              deal: { select: { id: true } },
            },
          },
        },
      },
    },
  });
  if (!stake) return null;

  const p = stake.project;
  const allStakes = await prisma.projectStakeholder.findMany({
    where: { tenantId, projectId },
    select: { investmentAmount: true },
  });
  let totalProjectAllocation = 0;
  for (const row of allStakes) {
    const amount = row.investmentAmount != null ? Number(row.investmentAmount) : 0;
    if (amount > 0) totalProjectAllocation += amount;
  }

  const dealIds = p.units.map((u) => u.deal?.id).filter((id): id is string => Boolean(id));

  const [invoices, payments, receipts] = await Promise.all([
    dealIds.length
      ? prisma.invoice.findMany({
          where: { tenantId, dealId: { in: dealIds }, status: { not: "VOID" } },
          select: { dealId: true, amount: true },
        })
      : Promise.resolve([]),
    dealIds.length
      ? prisma.paymentRecord.findMany({
          where: { tenantId, invoice: { dealId: { in: dealIds } } },
          select: {
            id: true,
            amount: true,
            currency: true,
            paidAt: true,
            payerName: true,
            invoice: { select: { title: true } },
          },
          orderBy: { paidAt: "desc" },
        })
      : Promise.resolve([]),
    dealIds.length
      ? prisma.salesReceipt.findMany({
          where: { tenantId, dealId: { in: dealIds } },
          select: {
            id: true,
            amount: true,
            currency: true,
            issuedAt: true,
            title: true,
            customerName: true,
          },
          orderBy: { issuedAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const totalCollected =
    payments.reduce((sum, pay) => sum + Number(pay.amount), 0) +
    receipts.reduce((sum, r) => sum + Number(r.amount), 0);

  const allocationAmount = stake.investmentAmount != null ? Number(stake.investmentAmount) : 0;
  const yourEarnings =
    totalProjectAllocation > 0 && allocationAmount > 0
      ? (totalCollected * allocationAmount) / totalProjectAllocation
      : 0;

  const projectPayments: PortfolioPayment[] = [
    ...payments.map((pay) => ({
      id: pay.id,
      amount: Number(pay.amount),
      currency: pay.currency,
      paidAt: pay.paidAt.toISOString(),
      label: pay.invoice?.title || pay.payerName || "Payment",
      projectName: p.name,
    })),
    ...receipts.map((receipt) => ({
      id: receipt.id,
      amount: Number(receipt.amount),
      currency: receipt.currency,
      paidAt: receipt.issuedAt.toISOString(),
      label: receipt.title || receipt.customerName || "Sales receipt",
      projectName: p.name,
    })),
  ].sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  return {
    projectId: p.id,
    projectName: p.name,
    currency: p.currency,
    coverImageUrl: p.coverImageUrl,
    city: p.locationCity,
    state: p.locationState,
    isPublished: p.isPublished,
    stakeType: stake.type,
    allocationAmount,
    totalProjectAllocation,
    unitsTotal: p.units.length,
    unitsSold: p.units.filter((u) => u.status === "SOLD").length,
    unitsReserved: p.units.filter((u) => u.status === "RESERVED").length,
    unitsAvailable: p.units.filter((u) => u.status === "AVAILABLE").length,
    totalInvoiced,
    totalCollected,
    outstanding: Math.max(totalInvoiced - totalCollected, 0),
    yourEarnings,
    description: p.listingDescription,
    locationAddress: p.locationAddress,
    galleryUrls: jsonStringArray(p.galleryUrls),
    amenities: jsonStringArray(p.amenities),
    payments: projectPayments,
  };
}

export type { PublicListing };

/** Published listings the investor is not yet linked to — opportunities to explore. */
export async function loadPortalDiscoverListings(
  tenantSlug: string,
  userId: string,
): Promise<PublicListing[]> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, settings: { select: { moduleListings: true } } },
  });
  if (!tenant || tenant.settings?.moduleListings === false) return [];

  const [listingsResult, stakes] = await Promise.all([
    loadPublicListings(tenantSlug, { limit: 50 }),
    prisma.projectStakeholder.findMany({
      where: { tenantId: tenant.id, userId },
      select: { projectId: true },
    }),
  ]);
  if (!listingsResult) return [];

  const stakedIds = new Set(stakes.map((s) => s.projectId));
  return listingsResult.listings.filter((l) => !stakedIds.has(l.id));
}

export type InvestorOrgSummary = {
  tenantSlug: string;
  tenantName: string;
  logoUrl: string | null;
  role: "INVESTOR" | "LISTING_OWNER";
  projectCount: number;
  allocated: number;
  earnings: number;
  currency: string;
};

const PORTAL_ROLES: MembershipRole[] = [MembershipRole.INVESTOR, MembershipRole.LISTING_OWNER];

/** All organizations where this user has an investor / listing-owner membership. */
export async function loadInvestorOrganizations(userId: string): Promise<InvestorOrgSummary[]> {
  const memberships = await prisma.membership.findMany({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
      role: { in: PORTAL_ROLES },
    },
    select: {
      role: true,
      tenant: {
        select: {
          id: true,
          slug: true,
          name: true,
          settings: { select: { logoUrl: true, moduleInvestorPortal: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const summaries: InvestorOrgSummary[] = [];
  for (const m of memberships) {
    if (m.tenant.settings?.moduleInvestorPortal === false) continue;
    const portfolio = await loadStakeholderPortfolio(m.tenant.id, userId);
    summaries.push({
      tenantSlug: m.tenant.slug,
      tenantName: m.tenant.name,
      logoUrl: m.tenant.settings?.logoUrl ?? null,
      role: m.role as "INVESTOR" | "LISTING_OWNER",
      projectCount: portfolio.totals.projects,
      allocated: portfolio.totals.allocated,
      earnings: portfolio.totals.earnings,
      currency: portfolio.totals.currency,
    });
  }
  return summaries;
}

export function isPortalOnlyMembership(role: MembershipRole): boolean {
  return PORTAL_ROLES.includes(role);
}
