import { HrFormRequestStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { brandingFromSettings } from "@/lib/tenant-branding";

export async function loadHrFormRequestByToken(token: string) {
  const req = await prisma.hrFormRequest.findUnique({
    where: { token },
    include: {
      profile: true,
      tenant: {
        select: {
          name: true,
          slug: true,
          settings: {
            select: {
              logoUrl: true,
              primaryColor: true,
              accentColor: true,
              orgEmail: true,
              orgPhone: true,
              orgAddressLine: true,
              orgCity: true,
              orgState: true,
              orgCountry: true,
              pensionAdministrators: true,
            },
          },
        },
      },
    },
  });

  if (!req) return null;

  const now = new Date();
  let status = req.status;
  if (status === HrFormRequestStatus.PENDING && req.expiresAt < now) {
    status = HrFormRequestStatus.EXPIRED;
    await prisma.hrFormRequest.update({
      where: { id: req.id },
      data: { status: HrFormRequestStatus.EXPIRED },
    });
  }

  const brand = brandingFromSettings(req.tenant.name, req.tenant.settings);

  return { ...req, status, brand };
}
