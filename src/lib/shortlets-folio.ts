import { formatEnumLabel } from "@/lib/ui-format";

export function formatReservationFolioBundle(
  reservation: {
    id: string;
    guestName: string;
    totalAmount: number | { toString(): string };
    amountPaid: number | { toString(): string };
    balanceDue: number | { toString(): string };
    currency: string;
    unit: { name: string } | null;
    property?: { name: string } | null;
    folioLines: Array<{
      id: string;
      department: string;
      description: string;
      quantity: number;
      amount: number | { toString(): string };
      currency: string;
      postedAt: Date;
    }>;
    payments: Array<{
      id: string;
      amount: number | { toString(): string };
      currency: string;
      paidAt: Date;
      method: string | null;
    }>;
  },
) {
  const currency = reservation.currency;
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(d);

  return {
    reservationId: reservation.id,
    guestName: reservation.guestName,
    unitName: reservation.unit?.name || reservation.property?.name || "Apartment TBD",
    totalAmountLabel: `${currency} ${Number(reservation.totalAmount).toLocaleString()}`,
    paidAmountLabel: `${currency} ${Number(reservation.amountPaid).toLocaleString()}`,
    balanceLabel: `${currency} ${Number(reservation.balanceDue).toLocaleString()}`,
    balanceDue: Number(reservation.balanceDue),
    currency,
    folioLines: reservation.folioLines.map((line) => ({
      id: line.id,
      department: formatEnumLabel(line.department),
      description: line.description,
      quantity: line.quantity,
      amountLabel: `${line.currency} ${Number(line.amount).toLocaleString()}`,
      postedAtLabel: fmt(line.postedAt),
    })),
    payments: reservation.payments.map((p) => ({
      id: p.id,
      amountLabel: `${p.currency} ${Number(p.amount).toLocaleString()}`,
      paidAtLabel: fmt(p.paidAt),
      method: p.method || "—",
    })),
  };
}

export const FOLIO_RESERVATION_INCLUDE = {
  unit: { select: { name: true } },
  property: { select: { name: true } },
  folioLines: { orderBy: { postedAt: "desc" as const } },
  payments: { orderBy: { paidAt: "desc" as const } },
} as const;
