import type { Prisma } from "@/generated/prisma";

type Tx = Prisma.TransactionClient;

export async function nextSalesReceiptNumber(tx: Tx, tenantId: string) {
  const seq = await tx.salesReceipt.count({ where: { tenantId } });
  return `SR-${String(seq + 1).padStart(5, "0")}`;
}

export async function syncShortletPaymentToFinance(
  tx: Tx,
  input: {
    tenantId: string;
    paymentId: string;
    guestName: string;
    amount: number;
    currency: string;
    paidAt: Date;
    method?: string | null;
    reference?: string | null;
    actorUserId: string;
    actorLabel: string;
  },
) {
  const payment = await tx.shortletPayment.findFirst({
    where: { id: input.paymentId, tenantId: input.tenantId },
    select: {
      reservation: {
        select: {
          unit: {
            select: {
              projectUnit: { select: { id: true, projectId: true } },
            },
          },
        },
      },
    },
  });
  const projectUnit = payment?.reservation.unit?.projectUnit;

  const receiptNumber = await nextSalesReceiptNumber(tx, input.tenantId);
  const receipt = await tx.salesReceipt.create({
    data: {
      tenantId: input.tenantId,
      receiptNumber,
      title: `Short let — ${input.guestName}`,
      customerName: input.guestName,
      amount: input.amount,
      currency: input.currency,
      paymentMode: input.method || "Short lets",
      reference: input.reference || null,
      note: "Auto-synced from short lets payment.",
      projectId: projectUnit?.projectId || null,
      unitId: projectUnit?.id || null,
      incomeType: "SHORTLET_REVENUE",
      createdByUserId: input.actorUserId,
      createdByLabel: input.actorLabel,
      issuedAt: input.paidAt,
    },
    select: { id: true, receiptNumber: true },
  });

  await tx.shortletPayment.update({
    where: { id: input.paymentId },
    data: { financeReceiptId: receipt.id },
  });

  return receipt;
}

export async function syncDayPaymentsToFinance(
  tx: Tx,
  input: {
    tenantId: string;
    businessDate: Date;
    actorUserId: string;
    actorLabel: string;
  },
) {
  const dayStart = new Date(input.businessDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(input.businessDate);
  dayEnd.setHours(23, 59, 59, 999);

  const payments = await tx.shortletPayment.findMany({
    where: {
      tenantId: input.tenantId,
      paidAt: { gte: dayStart, lte: dayEnd },
      financeReceiptId: null,
    },
    include: {
      reservation: { select: { guestName: true } },
    },
  });

  const receipts: Array<{ id: string; receiptNumber: string }> = [];
  for (const payment of payments) {
    const receipt = await syncShortletPaymentToFinance(tx, {
      tenantId: input.tenantId,
      paymentId: payment.id,
      guestName: payment.reservation.guestName,
      amount: Number(payment.amount),
      currency: payment.currency,
      paidAt: payment.paidAt,
      method: payment.method,
      reference: payment.reference,
      actorUserId: input.actorUserId,
      actorLabel: input.actorLabel,
    });
    receipts.push(receipt);
  }

  return receipts;
}
