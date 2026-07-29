import type { Prisma } from "@/generated/prisma";
import prisma from "@/lib/db";

type Db = Prisma.TransactionClient | typeof prisma;

function tenantPrefix(slug: string): string {
  const letters = slug
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 4)
    .toUpperCase();
  return letters || "EMP";
}

/** Allocates a unique employee number for a tenant, e.g. BOPR-2026-0007 */
export async function allocateEmployeeNumber(tenantId: string, db: Db = prisma): Promise<string> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
  const prefix = tenantPrefix(tenant?.slug ?? "emp");
  const year = new Date().getFullYear();
  const base = await db.employeeProfile.count({ where: { tenantId } });

  for (let i = 0; i < 200; i++) {
    const candidate = `${prefix}-${year}-${String(base + 1 + i).padStart(4, "0")}`;
    const clash = await db.employeeProfile.findFirst({
      where: { tenantId, employeeNumber: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }

  return `${prefix}-${year}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/** Assigns an employee number if the profile does not have one yet. */
export async function ensureEmployeeNumber(profileId: string, db: Db = prisma): Promise<string | null> {
  const profile = await db.employeeProfile.findUnique({
    where: { id: profileId },
    select: { employeeNumber: true, tenantId: true },
  });
  if (!profile) return null;
  if (profile.employeeNumber?.trim()) return profile.employeeNumber;

  const employeeNumber = await allocateEmployeeNumber(profile.tenantId, db);
  await db.employeeProfile.update({
    where: { id: profileId },
    data: { employeeNumber },
  });
  return employeeNumber;
}
