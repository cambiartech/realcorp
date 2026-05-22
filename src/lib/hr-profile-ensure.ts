import { EmployeeProfileStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { ensureEmployeeNumber } from "@/lib/hr-employee-number";

async function linkFormRequestsByEmail(tenantId: string, profileId: string, email?: string | null) {
  const normalized = email?.trim();
  if (!normalized) return;
  await prisma.hrFormRequest.updateMany({
    where: {
      tenantId,
      employeeProfileId: null,
      recipientEmail: { equals: normalized, mode: "insensitive" },
    },
    data: { employeeProfileId: profileId },
  });
}

/** Creates a draft HR profile for any active team member who opens My dashboard. */
export async function ensureEmployeeProfileForMember(
  tenantId: string,
  userId: string,
  fallback: { name?: string | null; email?: string | null },
) {
  const existing = await prisma.employeeProfile.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  if (existing) {
    await linkFormRequestsByEmail(tenantId, existing.id, fallback.email);
    await ensureEmployeeNumber(existing.id);
    return existing;
  }

  const created = await prisma.employeeProfile.create({
    data: {
      tenantId,
      userId,
      fullName: fallback.name || fallback.email || "Team member",
      workEmail: fallback.email,
      status: EmployeeProfileStatus.DRAFT,
    },
  });
  await linkFormRequestsByEmail(tenantId, created.id, fallback.email);
  await ensureEmployeeNumber(created.id);
  return created;
}
