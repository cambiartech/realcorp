import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { loadPublicListings, type PublicListing } from "@/lib/public-listings";
import { formatEnumLabel } from "@/lib/ui-format";

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
  /** Unit labels linked via the client profile (e.g. Palm P-07). */
  linkedUnitLabels?: string[];
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

type PortalClientFilter = {
  tenantId: string;
  OR: Array<{ userId: string } | { email: { equals: string; mode: "insensitive" } }>;
};

async function buildPortalClientFilter(tenantId: string, userId: string): Promise<PortalClientFilter> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const email = user?.email?.trim().toLowerCase();
  return {
    tenantId,
    OR: [
      { userId },
      ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
    ],
  };
}

function clientLinkStakeType(role: string): PortfolioProject["stakeType"] {
  return role === "INVESTOR" ? "INVESTOR" : "LISTING_OWNER";
}

async function loadClientLinkedProjects(
  tenantId: string,
  userId: string,
  excludeProjectIds: Set<string>,
): Promise<PortfolioProject[]> {
  const clientFilter = await buildPortalClientFilter(tenantId, userId);
  const clientUnitLinks = await prisma.clientUnitLink.findMany({
    where: { tenantId, client: clientFilter },
    select: {
      role: true,
      unit: {
        select: {
          id: true,
          label: true,
          status: true,
          projectId: true,
          deal: { select: { id: true } },
          project: {
            select: {
              id: true,
              name: true,
              currency: true,
              coverImageUrl: true,
              locationCity: true,
              locationState: true,
              isPublished: true,
            },
          },
        },
      },
    },
  });

  if (clientUnitLinks.length === 0) return [];

  const byProject = new Map<
    string,
    {
      project: (typeof clientUnitLinks)[0]["unit"]["project"];
      units: (typeof clientUnitLinks)[0]["unit"][];
      stakeType: PortfolioProject["stakeType"];
    }
  >();

  for (const link of clientUnitLinks) {
    if (excludeProjectIds.has(link.unit.projectId)) continue;
    const existing = byProject.get(link.unit.projectId);
    const stakeType = clientLinkStakeType(link.role);
    if (!existing) {
      byProject.set(link.unit.projectId, {
        project: link.unit.project,
        units: [link.unit],
        stakeType,
      });
    } else {
      existing.units.push(link.unit);
      if (link.role === "INVESTOR") existing.stakeType = "INVESTOR";
    }
  }

  const projects: PortfolioProject[] = [];

  for (const { project: p, units, stakeType } of byProject.values()) {
    const dealIds = units.map((u) => u.deal?.id).filter((id): id is string => Boolean(id));

    const [invoices, payments, receipts] = await Promise.all([
      dealIds.length
        ? prisma.invoice.findMany({
            where: { tenantId, dealId: { in: dealIds }, status: { not: "VOID" } },
            select: { amount: true },
          })
        : Promise.resolve([]),
      dealIds.length
        ? prisma.paymentRecord.findMany({
            where: { tenantId, invoice: { dealId: { in: dealIds } } },
            select: { amount: true },
          })
        : Promise.resolve([]),
      dealIds.length
        ? prisma.salesReceipt.findMany({
            where: { tenantId, dealId: { in: dealIds } },
            select: { amount: true },
          })
        : Promise.resolve([]),
    ]);

    const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const totalCollected =
      payments.reduce((sum, pay) => sum + Number(pay.amount), 0) +
      receipts.reduce((sum, r) => sum + Number(r.amount), 0);

    projects.push({
      projectId: p.id,
      projectName: p.name,
      currency: p.currency,
      coverImageUrl: p.coverImageUrl,
      city: p.locationCity,
      state: p.locationState,
      isPublished: p.isPublished,
      stakeType,
      allocationAmount: 0,
      totalProjectAllocation: 0,
      unitsTotal: units.length,
      unitsSold: units.filter((u) => u.status === "SOLD").length,
      unitsReserved: units.filter((u) => u.status === "RESERVED").length,
      unitsAvailable: units.filter((u) => u.status === "AVAILABLE").length,
      totalInvoiced,
      totalCollected,
      outstanding: Math.max(totalInvoiced - totalCollected, 0),
      yourEarnings: totalCollected,
      linkedUnitLabels: units.map((u) => u.label),
    });
  }

  return projects;
}

async function enrichProjectsWithClientUnitLabels(
  tenantId: string,
  userId: string,
  projects: PortfolioProject[],
): Promise<PortfolioProject[]> {
  if (projects.length === 0) return projects;
  const clientFilter = await buildPortalClientFilter(tenantId, userId);
  const links = await prisma.clientUnitLink.findMany({
    where: { tenantId, client: clientFilter },
    select: { unit: { select: { projectId: true, label: true } } },
  });
  const labelsByProject = new Map<string, string[]>();
  for (const link of links) {
    const list = labelsByProject.get(link.unit.projectId) ?? [];
    list.push(link.unit.label);
    labelsByProject.set(link.unit.projectId, list);
  }
  return projects.map((project) => ({
    ...project,
    linkedUnitLabels: labelsByProject.get(project.projectId) ?? project.linkedUnitLabels,
  }));
}

async function loadClientLinkedProjectIds(tenantId: string, userId: string): Promise<string[]> {
  const clientFilter = await buildPortalClientFilter(tenantId, userId);
  const links = await prisma.clientUnitLink.findMany({
    where: { tenantId, client: clientFilter },
    select: { unit: { select: { projectId: true } } },
  });
  return [...new Set(links.map((l) => l.unit.projectId))];
}

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
  const stakedProjectIds = new Set(projects.map((p) => p.projectId));
  const enrichedStakeProjects = await enrichProjectsWithClientUnitLabels(tenantId, userId, projects);
  const clientLinkedProjects = await loadClientLinkedProjects(tenantId, userId, stakedProjectIds);
  const allProjects = [...enrichedStakeProjects, ...clientLinkedProjects];

  let mergedRecentPayments = recentPayments;
  if (clientLinkedProjects.length > 0) {
    const clientFilter = await buildPortalClientFilter(tenantId, userId);
    const clientLinks = await prisma.clientUnitLink.findMany({
      where: { tenantId, client: clientFilter },
      select: {
        unit: {
          select: {
            project: { select: { id: true, name: true } },
            deal: { select: { id: true } },
          },
        },
      },
    });
    const clientDealToProject = new Map<string, string>();
    for (const link of clientLinks) {
      const dealId = link.unit.deal?.id;
      if (dealId) clientDealToProject.set(dealId, link.unit.project.name);
    }
    const clientDealIds = [...clientDealToProject.keys()];
    if (clientDealIds.length > 0) {
      const [clientPayments, clientReceipts] = await Promise.all([
        prisma.paymentRecord.findMany({
          where: { tenantId, invoice: { dealId: { in: clientDealIds } } },
          select: {
            id: true,
            amount: true,
            currency: true,
            paidAt: true,
            payerName: true,
            invoice: { select: { dealId: true, title: true } },
          },
          orderBy: { paidAt: "desc" },
          take: 12,
        }),
        prisma.salesReceipt.findMany({
          where: { tenantId, dealId: { in: clientDealIds } },
          select: {
            id: true,
            amount: true,
            currency: true,
            issuedAt: true,
            title: true,
            customerName: true,
            dealId: true,
          },
          orderBy: { issuedAt: "desc" },
          take: 12,
        }),
      ]);
      const clientRecentPayments: PortfolioPayment[] = [
        ...clientPayments.map((pay) => ({
          id: pay.id,
          amount: Number(pay.amount),
          currency: pay.currency,
          paidAt: pay.paidAt.toISOString(),
          label: pay.invoice?.title || pay.payerName || "Payment",
          projectName: clientDealToProject.get(pay.invoice?.dealId ?? "") ?? "",
        })),
        ...clientReceipts.map((receipt) => ({
          id: receipt.id,
          amount: Number(receipt.amount),
          currency: receipt.currency,
          paidAt: receipt.issuedAt.toISOString(),
          label: receipt.title || receipt.customerName || "Sales receipt",
          projectName: clientDealToProject.get(receipt.dealId ?? "") ?? "",
        })),
      ];
      mergedRecentPayments = [...recentPayments, ...clientRecentPayments]
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
        .slice(0, 12);
    }
  }

  return {
    projects: allProjects,
    totals: {
      currency: allProjects[0]?.currency ?? currency,
      allocated: allProjects.reduce((sum, p) => sum + p.allocationAmount, 0),
      collected: allProjects.reduce((sum, p) => sum + p.totalCollected, 0),
      earnings: allProjects.reduce((sum, p) => sum + p.yourEarnings, 0),
      projects: allProjects.length,
    },
    recentPayments: mergedRecentPayments,
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

  const clientFilter = await buildPortalClientFilter(tenantId, userId);
  const clientUnitLinks = stake
    ? []
    : await prisma.clientUnitLink.findMany({
        where: {
          tenantId,
          client: clientFilter,
          unit: { projectId },
        },
        select: {
          role: true,
          unit: {
            select: {
              status: true,
              deal: { select: { id: true } },
            },
          },
        },
      });

  if (!stake && clientUnitLinks.length === 0) return null;

  const p = stake?.project ?? (await prisma.project.findFirst({
    where: { id: projectId, tenantId },
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
  }));
  if (!p) return null;

  const linkedUnits = clientUnitLinks.map((l) => l.unit);
  const clientStakeType = clientUnitLinks.some((l) => l.role === "INVESTOR")
    ? ("INVESTOR" as const)
    : ("LISTING_OWNER" as const);
  const allStakes = await prisma.projectStakeholder.findMany({
    where: { tenantId, projectId },
    select: { investmentAmount: true },
  });
  let totalProjectAllocation = 0;
  for (const row of allStakes) {
    const amount = row.investmentAmount != null ? Number(row.investmentAmount) : 0;
    if (amount > 0) totalProjectAllocation += amount;
  }

  const dealIds = stake
    ? p.units.map((u) => u.deal?.id).filter((id): id is string => Boolean(id))
    : linkedUnits.map((u) => u.deal?.id).filter((id): id is string => Boolean(id));

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

  const allocationAmount = stake?.investmentAmount != null ? Number(stake.investmentAmount) : 0;
  const yourEarnings = stake
    ? totalProjectAllocation > 0 && allocationAmount > 0
      ? (totalCollected * allocationAmount) / totalProjectAllocation
      : 0
    : totalCollected;

  const unitsForCounts = stake ? p.units : linkedUnits;

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
    stakeType: stake?.type ?? clientStakeType,
    allocationAmount,
    totalProjectAllocation,
    unitsTotal: unitsForCounts.length,
    unitsSold: unitsForCounts.filter((u) => u.status === "SOLD").length,
    unitsReserved: unitsForCounts.filter((u) => u.status === "RESERVED").length,
    unitsAvailable: unitsForCounts.filter((u) => u.status === "AVAILABLE").length,
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

  const [listingsResult, stakes, clientProjectIds] = await Promise.all([
    loadPublicListings(tenantSlug, { limit: 50 }),
    prisma.projectStakeholder.findMany({
      where: { tenantId: tenant.id, userId },
      select: { projectId: true },
    }),
    loadClientLinkedProjectIds(tenant.id, userId),
  ]);
  if (!listingsResult) return [];

  const linkedProjectIds = new Set([...stakes.map((s) => s.projectId), ...clientProjectIds]);
  return listingsResult.listings.filter((l) => !linkedProjectIds.has(l.id));
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

export type InvestorShortletUnit = {
  unitId: string;
  unitName: string;
  projectId: string;
  projectName: string;
  allocationAmount: number;
  totalProjectAllocation: number;
  totalCollected: number;
  yourEarnings: number;
  currency: string;
  reservationCount: number;
};

export type InvestorShortletPortfolio = {
  units: InvestorShortletUnit[];
  totals: {
    currency: string;
    collected: number;
    earnings: number;
    units: number;
  };
};

/** Short-let earnings from client-linked apartments and project-stake shortlets. */
export async function loadInvestorShortletPortfolio(
  tenantId: string,
  userId: string,
): Promise<InvestorShortletPortfolio> {
  const clientFilter = await buildPortalClientFilter(tenantId, userId);
  const clientShortletLinks = await prisma.clientShortletLink.findMany({
    where: { tenantId, client: clientFilter },
    select: {
      shortletUnit: {
        select: {
          id: true,
          name: true,
          currency: true,
          property: { select: { name: true } },
        },
      },
    },
  });

  const clientUnitIds = clientShortletLinks.map((l) => l.shortletUnit.id);
  const clientReservations =
    clientUnitIds.length > 0
      ? await prisma.shortletReservation.findMany({
          where: {
            tenantId,
            unitId: { in: clientUnitIds },
            status: { in: ["CHECKED_OUT", "CHECKED_IN"] },
          },
          select: { unitId: true, amountPaid: true },
        })
      : [];

  const collectedByClientUnit = new Map<string, number>();
  const countByClientUnit = new Map<string, number>();
  for (const r of clientReservations) {
    if (!r.unitId) continue;
    collectedByClientUnit.set(r.unitId, (collectedByClientUnit.get(r.unitId) ?? 0) + Number(r.amountPaid));
    countByClientUnit.set(r.unitId, (countByClientUnit.get(r.unitId) ?? 0) + 1);
  }

  const clientUnits: InvestorShortletUnit[] = clientShortletLinks.map((link) => {
    const unit = link.shortletUnit;
    const totalCollected = collectedByClientUnit.get(unit.id) ?? 0;
    return {
      unitId: unit.id,
      unitName: unit.name,
      projectId: unit.id,
      projectName: unit.property?.name ?? "Short-let",
      allocationAmount: 0,
      totalProjectAllocation: 0,
      totalCollected,
      yourEarnings: totalCollected,
      currency: unit.currency,
      reservationCount: countByClientUnit.get(unit.id) ?? 0,
    };
  });

  const stakes = await prisma.projectStakeholder.findMany({
    where: { tenantId, userId },
    select: {
      investmentAmount: true,
      projectId: true,
      project: { select: { id: true, name: true, currency: true } },
    },
  });

  if (stakes.length === 0) {
    const currency = clientUnits[0]?.currency ?? "NGN";
    return {
      units: clientUnits,
      totals: {
        currency,
        collected: clientUnits.reduce((s, u) => s + u.totalCollected, 0),
        earnings: clientUnits.reduce((s, u) => s + u.yourEarnings, 0),
        units: clientUnits.length,
      },
    };
  }

  const projectIds = stakes.map((s) => s.projectId);
  const stakeByProject = new Map(
    stakes.map((s) => [s.projectId, { allocation: Number(s.investmentAmount ?? 0), project: s.project }]),
  );

  const allProjectStakes = await prisma.projectStakeholder.findMany({
    where: { tenantId, projectId: { in: projectIds } },
    select: { projectId: true, investmentAmount: true },
  });
  const totalAllocationByProject = new Map<string, number>();
  for (const row of allProjectStakes) {
    const amount = row.investmentAmount != null ? Number(row.investmentAmount) : 0;
    if (amount <= 0) continue;
    totalAllocationByProject.set(
      row.projectId,
      (totalAllocationByProject.get(row.projectId) ?? 0) + amount,
    );
  }

  const shortletUnits = await prisma.shortletUnit.findMany({
    where: {
      tenantId,
      projectUnitId: { not: null },
      projectUnit: { projectId: { in: projectIds } },
    },
    select: {
      id: true,
      name: true,
      currency: true,
      projectUnit: { select: { projectId: true } },
    },
  });

  if (shortletUnits.length === 0) {
    const currency = clientUnits[0]?.currency ?? stakes[0]?.project.currency ?? "NGN";
    const merged = clientUnits;
    return {
      units: merged,
      totals: {
        currency,
        collected: merged.reduce((s, u) => s + u.totalCollected, 0),
        earnings: merged.reduce((s, u) => s + u.yourEarnings, 0),
        units: merged.length,
      },
    };
  }

  const unitIds = shortletUnits.map((u) => u.id);
  const reservations = await prisma.shortletReservation.findMany({
    where: {
      tenantId,
      unitId: { in: unitIds },
      status: { in: ["CHECKED_OUT", "CHECKED_IN"] },
    },
    select: { unitId: true, amountPaid: true },
  });

  const collectedByUnit = new Map<string, number>();
  const countByUnit = new Map<string, number>();
  for (const r of reservations) {
    if (!r.unitId) continue;
    collectedByUnit.set(r.unitId, (collectedByUnit.get(r.unitId) ?? 0) + Number(r.amountPaid));
    countByUnit.set(r.unitId, (countByUnit.get(r.unitId) ?? 0) + 1);
  }

  const stakeUnits: InvestorShortletUnit[] = shortletUnits.map((unit) => {
    const projectId = unit.projectUnit!.projectId;
    const stake = stakeByProject.get(projectId);
    const allocationAmount = stake?.allocation ?? 0;
    const totalProjectAllocation = totalAllocationByProject.get(projectId) ?? 0;
    const totalCollected = collectedByUnit.get(unit.id) ?? 0;
    const yourEarnings =
      totalProjectAllocation > 0 && allocationAmount > 0
        ? (totalCollected * allocationAmount) / totalProjectAllocation
        : 0;
    return {
      unitId: unit.id,
      unitName: unit.name,
      projectId,
      projectName: stake?.project.name ?? "Project",
      allocationAmount,
      totalProjectAllocation,
      totalCollected,
      yourEarnings,
      currency: unit.currency || stake?.project.currency || "NGN",
      reservationCount: countByUnit.get(unit.id) ?? 0,
    };
  });

  const clientUnitIdSet = new Set(clientUnits.map((u) => u.unitId));
  const units = [...clientUnits, ...stakeUnits.filter((u) => !clientUnitIdSet.has(u.unitId))];

  const currency = units[0]?.currency ?? stakes[0]?.project.currency ?? "NGN";
  return {
    units,
    totals: {
      currency,
      collected: units.reduce((s, u) => s + u.totalCollected, 0),
      earnings: units.reduce((s, u) => s + u.yourEarnings, 0),
      units: units.length,
    },
  };
}

export type InvestorClientDocument = {
  id: string;
  category: string;
  title: string;
  fileUrl: string;
  fileName: string;
  uploadedAtLabel: string;
};

/** Client documents the admin has marked visible in the investor portal. */
export async function loadInvestorClientDocuments(
  tenantId: string,
  userId: string,
): Promise<InvestorClientDocument[]> {
  const clientFilter = await buildPortalClientFilter(tenantId, userId);
  const docs = await prisma.clientDocument.findMany({
    where: {
      tenantId,
      visibleInPortal: true,
      client: clientFilter,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      category: true,
      title: true,
      fileUrl: true,
      fileName: true,
      createdAt: true,
    },
  });

  return docs.map((doc) => ({
    id: doc.id,
    category: formatEnumLabel(doc.category),
    title: doc.title,
    fileUrl: doc.fileUrl,
    fileName: doc.fileName ?? doc.title,
    uploadedAtLabel: doc.createdAt.toISOString().slice(0, 10),
  }));
}
