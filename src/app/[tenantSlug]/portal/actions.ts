"use server";

import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { isPortalOnlyRole } from "@/lib/tenant-nav-access";
import { z } from "zod";

const investorInterestSchema = z.object({
  projectId: z.string().trim().min(1),
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(32).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function submitInvestorInterest(
  tenantSlug: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = investorInterestSchema.safeParse({
    projectId: formData.get("projectId"),
    phone: formData.get("phone") ?? "",
    message: formData.get("message") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, name: true },
  });
  if (!tenant) return { ok: false, error: "Organization not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });
  const allowed =
    Boolean(session.user.isPlatformAdmin) ||
    (membership?.status === MembershipStatus.ACTIVE &&
      (membership.role === MembershipRole.ORG_ADMIN || isPortalOnlyRole(membership.role)));
  if (!allowed) {
    return { ok: false, error: "You do not have access to express interest from the investor portal." };
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, tenantId: tenant.id, isPublished: true },
    select: { id: true, name: true },
  });
  if (!project) return { ok: false, error: "This opportunity is no longer available." };

  const client = await prisma.propertyClient.findFirst({
    where: { tenantId: tenant.id, userId: session.user.id },
    select: { id: true, fullName: true, email: true, phone: true, alternatePhone: true },
  });

  const name = client?.fullName || session.user.name || session.user.email || "Investor";
  const email = session.user.email || client?.email || null;
  const phone = parsed.data.phone?.trim() || client?.phone || client?.alternatePhone || null;

  if (!phone) {
    return { ok: false, error: "Add a phone number so the team can reach you." };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.lead.findFirst({
    where: {
      tenantId: tenant.id,
      phone,
      projectInterest: project.name,
      createdAt: { gte: oneHourAgo },
    },
    select: { id: true },
  });
  if (recent) return { ok: true };

  const roleLabel = membership?.role === MembershipRole.LISTING_OWNER ? "Listing owner" : "Investor";

  await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      name,
      phone,
      email,
      notes: parsed.data.message
        ? `${roleLabel} portal interest in ${project.name}: ${parsed.data.message}`
        : `${roleLabel} portal — expressed interest in ${project.name} (existing portal member).`,
      source: "Investor portal",
      projectInterest: project.name,
      lastActivityAt: new Date(),
    },
  });

  if (client && !client.phone && !client.alternatePhone && parsed.data.phone) {
    await prisma.propertyClient.update({
      where: { id: client.id },
      data: { phone: parsed.data.phone },
    });
  }

  return { ok: true };
}
