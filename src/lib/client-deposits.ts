import prisma from "@/lib/db";
import { remainingClientBalance, summarizeClientDeposits } from "@/lib/finance-income";

export { summarizeClientDeposits };

export type ClientDepositRow = {
  id: string;
  clientId: string;
  clientName: string;
  projectId: string;
  projectLabel: string;
  unitId: string;
  unitLabel: string;
  contractValue: number;
  expectedDeposit: number;
  depositsPaid: number;
  collected: number;
  remaining: number;
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function allocationKey(projectId: string, unitId: string) {
  return `${projectId || "__none"}|${unitId || "__none"}`;
}

export async function loadClientDepositRows(
  tenantId: string,
  options?: { clientId?: string },
): Promise<ClientDepositRow[]> {
  const clientFilter = options?.clientId ? { id: options.clientId } : {};

  const clients = await prisma.propertyClient.findMany({
    where: { tenantId, ...clientFilter },
    select: {
      id: true,
      fullName: true,
      dealId: true,
      deal: {
        select: {
          id: true,
          value: true,
          unitId: true,
          unit: {
            select: {
              id: true,
              label: true,
              projectId: true,
              project: { select: { name: true } },
              pricingPlan: { select: { price: true, initialDeposit: true } },
            },
          },
        },
      },
      unitLinks: {
        select: {
          unitId: true,
          unit: {
            select: {
              id: true,
              label: true,
              projectId: true,
              project: { select: { name: true } },
              pricingPlan: { select: { price: true, initialDeposit: true } },
              deal: { select: { id: true, value: true } },
            },
          },
        },
      },
    },
    take: 800,
  });

  const linkedUnitIds = [
    ...new Set(
      clients.flatMap((client) => [
        ...client.unitLinks.map((link) => link.unitId),
        ...(client.deal?.unitId ? [client.deal.unitId] : []),
      ]),
    ),
  ];

  const [payments, receipts] = await Promise.all([
    prisma.paymentRecord.findMany({
      where: {
        tenantId,
        voidedAt: null,
        ...(options?.clientId
          ? {
              OR: [
                { propertyClientId: options.clientId },
                { invoice: { deal: { propertyClient: { id: options.clientId } } } },
                ...(linkedUnitIds.length ? [{ unitId: { in: linkedUnitIds } }] : []),
              ],
            }
          : {}),
      },
      select: {
        id: true,
        amount: true,
        incomeType: true,
        projectId: true,
        unitId: true,
        propertyClientId: true,
        invoice: {
          select: {
            deal: { select: { propertyClient: { select: { id: true } } } },
          },
        },
      },
      take: 4000,
    }),
    prisma.salesReceipt.findMany({
      where: {
        tenantId,
        voidedAt: null,
        NOT: { status: "VOID" },
        ...(options?.clientId
          ? {
              OR: [
                { deal: { propertyClient: { id: options.clientId } } },
                ...(linkedUnitIds.length ? [{ unitId: { in: linkedUnitIds } }] : []),
              ],
            }
          : {}),
      },
      select: {
        id: true,
        amount: true,
        incomeType: true,
        projectId: true,
        unitId: true,
        deal: { select: { propertyClient: { select: { id: true } } } },
      },
      take: 4000,
    }),
  ]);

  const unitOwners = new Map<string, string[]>();
  for (const client of clients) {
    for (const link of client.unitLinks) {
      const owners = unitOwners.get(link.unitId) ?? [];
      owners.push(client.id);
      unitOwners.set(link.unitId, owners);
    }
    if (client.deal?.unitId) {
      const owners = unitOwners.get(client.deal.unitId) ?? [];
      if (!owners.includes(client.id)) {
        owners.push(client.id);
        unitOwners.set(client.deal.unitId, owners);
      }
    }
  }

  type Cash = { collected: number; deposits: number };
  const cashByClientUnit = new Map<string, Cash>();

  const addCash = (clientId: string | null | undefined, projectId: string, unitId: string, amount: number, incomeType: string) => {
    let resolvedClientId = clientId || "";
    if (!resolvedClientId && unitId) {
      const owners = unitOwners.get(unitId) ?? [];
      if (owners.length === 1) resolvedClientId = owners[0];
    }
    if (!resolvedClientId) return;
    const key = `${resolvedClientId}|${allocationKey(projectId, unitId)}`;
    const current = cashByClientUnit.get(key) || { collected: 0, deposits: 0 };
    current.collected = money(current.collected + amount);
    if (incomeType === "CLIENT_DEPOSIT") current.deposits = money(current.deposits + amount);
    cashByClientUnit.set(key, current);
  };

  for (const payment of payments) {
    addCash(
      payment.propertyClientId || payment.invoice?.deal?.propertyClient?.id,
      payment.projectId || "",
      payment.unitId || "",
      Number(payment.amount),
      payment.incomeType,
    );
  }
  for (const receipt of receipts) {
    addCash(
      receipt.deal?.propertyClient?.id,
      receipt.projectId || "",
      receipt.unitId || "",
      Number(receipt.amount),
      receipt.incomeType,
    );
  }

  const rows: ClientDepositRow[] = [];
  const seen = new Set<string>();

  for (const client of clients) {
    const units = new Map<
      string,
      {
        projectId: string;
        projectLabel: string;
        unitId: string;
        unitLabel: string;
        contractValue: number;
        expectedDeposit: number;
      }
    >();

    for (const link of client.unitLinks) {
      units.set(link.unit.id, {
        projectId: link.unit.projectId,
        projectLabel: link.unit.project.name,
        unitId: link.unit.id,
        unitLabel: link.unit.label,
        contractValue: Number(link.unit.deal?.value) || Number(link.unit.pricingPlan?.price) || 0,
        expectedDeposit: Number(link.unit.pricingPlan?.initialDeposit) || 0,
      });
    }

    if (client.deal?.unit) {
      const unit = client.deal.unit;
      const existing = units.get(unit.id);
      units.set(unit.id, {
        projectId: unit.projectId,
        projectLabel: unit.project.name,
        unitId: unit.id,
        unitLabel: unit.label,
        contractValue:
          Number(client.deal.value) ||
          existing?.contractValue ||
          Number(unit.pricingPlan?.price) ||
          0,
        expectedDeposit: existing?.expectedDeposit || Number(unit.pricingPlan?.initialDeposit) || 0,
      });
    }

    for (const unit of units.values()) {
      const cashKey = `${client.id}|${allocationKey(unit.projectId, unit.unitId)}`;
      const cash = cashByClientUnit.get(cashKey);
      seen.add(cashKey);
      rows.push({
        id: cashKey,
        clientId: client.id,
        clientName: client.fullName,
        projectId: unit.projectId,
        projectLabel: unit.projectLabel,
        unitId: unit.unitId,
        unitLabel: unit.unitLabel,
        contractValue: unit.contractValue,
        expectedDeposit: unit.expectedDeposit,
        depositsPaid: cash?.deposits || 0,
        collected: cash?.collected || 0,
        remaining: remainingClientBalance({
          contractValue: unit.contractValue,
          collected: cash?.collected || 0,
        }),
      });
    }
  }

  for (const [key, cash] of cashByClientUnit) {
    if (seen.has(key)) continue;
    const [clientId, projectIdRaw, unitIdRaw] = key.split("|");
    const client = clients.find((row) => row.id === clientId);
    if (!client) continue;
    rows.push({
      id: key,
      clientId: client.id,
      clientName: client.fullName,
      projectId: projectIdRaw === "__none" ? "" : projectIdRaw,
      projectLabel: "Unassigned project",
      unitId: unitIdRaw === "__none" ? "" : unitIdRaw,
      unitLabel: "Unassigned unit",
      contractValue: 0,
      expectedDeposit: 0,
      depositsPaid: cash.deposits,
      collected: cash.collected,
      remaining: 0,
    });
  }

  return rows
    .filter((row) => row.contractValue > 0 || row.collected > 0)
    .sort((a, b) => b.remaining - a.remaining || a.clientName.localeCompare(b.clientName));
}
