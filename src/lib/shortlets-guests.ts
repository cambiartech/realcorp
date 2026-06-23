import type { Prisma } from "@/generated/prisma";

type Tx = Prisma.TransactionClient;

export function splitGuestName(guestName: string): { firstName: string; lastName: string | null; fullName: string } {
  const trimmed = guestName.trim().replace(/\s+/g, " ");
  const parts = trimmed.split(" ");
  const firstName = parts[0] || trimmed;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
  return { firstName, lastName, fullName: trimmed };
}

/** Short-stay guest CRM — separate from PropertyClient (sales/investor clients). */
export async function findOrCreateShortletGuest(
  tx: Tx,
  input: {
    tenantId: string;
    guestName: string;
    guestEmail?: string | null;
    guestPhone?: string | null;
  },
): Promise<string> {
  const email = input.guestEmail?.trim() || null;
  const phone = input.guestPhone?.trim() || null;
  const { firstName, lastName, fullName } = splitGuestName(input.guestName);

  if (email || phone) {
    const existing = await tx.shortletGuest.findFirst({
      where: {
        tenantId: input.tenantId,
        OR: [
          ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      select: { id: true, fullName: true },
    });
    if (existing) {
      if (existing.fullName !== fullName) {
        await tx.shortletGuest.update({
          where: { id: existing.id },
          data: { firstName, lastName, fullName, ...(email ? { email } : {}), ...(phone ? { phone } : {}) },
        });
      }
      return existing.id;
    }
  }

  const created = await tx.shortletGuest.create({
    data: {
      tenantId: input.tenantId,
      firstName,
      lastName,
      fullName,
      email,
      phone,
    },
    select: { id: true },
  });
  return created.id;
}
