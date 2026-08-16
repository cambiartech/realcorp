import prisma from "@/lib/db";

export type ShortletIncomeGroup = {
  id: string;
  label: string;
  collected: number;
  outstanding: number;
  reservations: number;
  financeSynced: number;
};

export type ShortletIncomePaymentRow = {
  id: string;
  paidAtLabel: string;
  guestName: string;
  propertyLabel: string;
  apartmentLabel: string;
  projectLabel: string;
  amount: number;
  method: string;
  synced: boolean;
};

export type ShortletIncomeReport = {
  collected: number;
  outstanding: number;
  folioCharges: number;
  financeSynced: number;
  byProject: ShortletIncomeGroup[];
  byProperty: ShortletIncomeGroup[];
  byApartment: ShortletIncomeGroup[];
  payments: ShortletIncomePaymentRow[];
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function bump(
  map: Map<string, ShortletIncomeGroup>,
  id: string,
  label: string,
  patch: Partial<ShortletIncomeGroup>,
) {
  const current = map.get(id) || {
    id,
    label,
    collected: 0,
    outstanding: 0,
    reservations: 0,
    financeSynced: 0,
  };
  current.collected = money(current.collected + (patch.collected || 0));
  current.outstanding = money(current.outstanding + (patch.outstanding || 0));
  current.reservations += patch.reservations || 0;
  current.financeSynced = money(current.financeSynced + (patch.financeSynced || 0));
  map.set(id, current);
}

export async function loadShortletIncomeReport(tenantId: string): Promise<ShortletIncomeReport> {
  const [payments, reservations, folioLines] = await Promise.all([
    prisma.shortletPayment.findMany({
      where: { tenantId },
      orderBy: { paidAt: "desc" },
      take: 2000,
      select: {
        id: true,
        amount: true,
        paidAt: true,
        method: true,
        financeReceiptId: true,
        reservation: {
          select: {
            guestName: true,
            property: { select: { id: true, name: true } },
            unit: {
              select: {
                id: true,
                name: true,
                property: { select: { id: true, name: true } },
                projectUnit: {
                  select: {
                    label: true,
                    project: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.shortletReservation.findMany({
      where: { tenantId, status: { notIn: ["CANCELLED"] } },
      select: {
        id: true,
        balanceDue: true,
        property: { select: { id: true, name: true } },
        unit: {
          select: {
            id: true,
            name: true,
            property: { select: { id: true, name: true } },
            projectUnit: { select: { project: { select: { id: true, name: true } } } },
          },
        },
      },
      take: 2000,
    }),
    prisma.shortletFolioLine.findMany({
      where: { tenantId },
      select: {
        quantity: true,
        unitPrice: true,
        reservation: {
          select: {
            property: { select: { id: true, name: true } },
            unit: {
              select: {
                property: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      take: 4000,
    }),
  ]);

  const byProject = new Map<string, ShortletIncomeGroup>();
  const byProperty = new Map<string, ShortletIncomeGroup>();
  const byApartment = new Map<string, ShortletIncomeGroup>();
  let collected = 0;
  let financeSynced = 0;

  const paymentRows: ShortletIncomePaymentRow[] = payments.map((payment) => {
    const amount = Number(payment.amount);
    const property = payment.reservation.property || payment.reservation.unit?.property;
    const apartment = payment.reservation.unit;
    const project = apartment?.projectUnit?.project;
    collected = money(collected + amount);
    if (payment.financeReceiptId) financeSynced = money(financeSynced + amount);

    if (project) {
      bump(byProject, project.id, project.name, {
        collected: amount,
        financeSynced: payment.financeReceiptId ? amount : 0,
      });
    } else {
      bump(byProject, "__none", "Not linked to a sales project", {
        collected: amount,
        financeSynced: payment.financeReceiptId ? amount : 0,
      });
    }
    bump(byProperty, property?.id || "__none", property?.name || "Standalone / unassigned", {
      collected: amount,
      financeSynced: payment.financeReceiptId ? amount : 0,
    });
    if (apartment) {
      bump(byApartment, apartment.id, apartment.name, {
        collected: amount,
        financeSynced: payment.financeReceiptId ? amount : 0,
      });
    }

    return {
      id: payment.id,
      paidAtLabel: payment.paidAt.toISOString().slice(0, 10),
      guestName: payment.reservation.guestName,
      propertyLabel: property?.name || "Standalone",
      apartmentLabel: apartment?.name || "—",
      projectLabel: project?.name || "—",
      amount,
      method: payment.method || "—",
      synced: Boolean(payment.financeReceiptId),
    };
  });

  let outstanding = 0;
  const seenReservations = new Set<string>();
  for (const reservation of reservations) {
    const due = Number(reservation.balanceDue);
    if (due <= 0) continue;
    outstanding = money(outstanding + due);
    const property = reservation.property || reservation.unit?.property;
    const project = reservation.unit?.projectUnit?.project;
    if (!seenReservations.has(reservation.id)) {
      seenReservations.add(reservation.id);
      bump(byProject, project?.id || "__none", project?.name || "Not linked to a sales project", {
        outstanding: due,
        reservations: 1,
      });
      bump(byProperty, property?.id || "__none", property?.name || "Standalone / unassigned", {
        outstanding: due,
        reservations: 1,
      });
      if (reservation.unit) {
        bump(byApartment, reservation.unit.id, reservation.unit.name, {
          outstanding: due,
          reservations: 1,
        });
      }
    }
  }

  const folioCharges = money(
    folioLines.reduce((sum, line) => sum + Number(line.unitPrice) * line.quantity, 0),
  );

  const sortGroups = (rows: ShortletIncomeGroup[]) =>
    rows.sort((a, b) => b.collected - a.collected || a.label.localeCompare(b.label));

  return {
    collected,
    outstanding,
    folioCharges,
    financeSynced,
    byProject: sortGroups(Array.from(byProject.values())),
    byProperty: sortGroups(Array.from(byProperty.values())),
    byApartment: sortGroups(Array.from(byApartment.values())),
    payments: paymentRows.slice(0, 200),
  };
}
