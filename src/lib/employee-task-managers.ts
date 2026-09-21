import prisma from "@/lib/db";

/** User IDs this manager may assign tasks to via EmployeeTaskManager grants. */
export async function loadManageeUserIds(tenantId: string, managerUserId: string): Promise<string[]> {
  const rows = await prisma.employeeTaskManager.findMany({
    where: { tenantId, managerUserId },
    select: { reportUserId: true },
  });
  return rows.map((r) => r.reportUserId);
}

export async function loadTaskManagersForUser(
  tenantId: string,
  reportUserId: string,
): Promise<Array<{ managerUserId: string; label: string }>> {
  const rows = await prisma.employeeTaskManager.findMany({
    where: { tenantId, reportUserId },
    select: { managerUserId: true },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.managerUserId) } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(users.map((u) => [u.id, u.name || u.email || "Member"]));
  return rows.map((r) => ({
    managerUserId: r.managerUserId,
    label: byId.get(r.managerUserId) || "Member",
  }));
}
