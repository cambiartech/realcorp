import type { Prisma } from "@/generated/prisma";

type Tx = Prisma.TransactionClient;

export async function nextShortletBookingNumber(tx: Tx, tenantId: string): Promise<string> {
  const count = await tx.shortletReservation.count({ where: { tenantId } });
  const seq = String(count + 1).padStart(5, "0");
  const date = new Date();
  const ymd = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  return `SL-${ymd}-${seq}`;
}
