import { PropertyClientStatus } from "@/generated/prisma";
import type { Prisma } from "@/generated/prisma";

type Tx = Prisma.TransactionClient;

export async function findOrCreateShortletGuestClient(
  tx: Tx,
  input: {
    tenantId: string;
    guestName: string;
    guestEmail?: string | null;
    guestPhone?: string | null;
    activate?: boolean;
  },
): Promise<string | null> {
  const email = input.guestEmail?.trim() || null;
  const phone = input.guestPhone?.trim() || null;
  if (!email && !phone) return null;

  const existing = await tx.propertyClient.findFirst({
    where: {
      tenantId: input.tenantId,
      OR: [
        ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
        ...(phone ? [{ phone }] : []),
        ...(phone ? [{ alternatePhone: phone }] : []),
      ],
    },
    select: { id: true, status: true },
  });

  if (existing) {
    if (input.activate && existing.status === PropertyClientStatus.PROSPECT) {
      await tx.propertyClient.update({
        where: { id: existing.id },
        data: { status: PropertyClientStatus.ACTIVE },
      });
    }
    return existing.id;
  }

  const created = await tx.propertyClient.create({
    data: {
      tenantId: input.tenantId,
      fullName: input.guestName.trim(),
      email,
      phone,
      status: input.activate ? PropertyClientStatus.ACTIVE : PropertyClientStatus.PROSPECT,
      notes: "Created from short lets reservation.",
    },
    select: { id: true },
  });
  return created.id;
}

export function guestClientProfileHref(tenantSlug: string, clientId: string | null | undefined, moduleClients: boolean) {
  if (!clientId || !moduleClients) return null;
  return `/${tenantSlug}/clients/${clientId}`;
}
