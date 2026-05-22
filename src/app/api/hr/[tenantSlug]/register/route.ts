import { auth } from "@/auth";
import { MembershipStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { canManageHr } from "@/lib/hr-access";
import { employeeRegisterToCsv, type EmployeeRegisterRow } from "@/lib/hr-register-csv";
import { NextRequest, NextResponse } from "next/server";

function bankField(bank: unknown, key: string): string {
  if (!bank || typeof bank !== "object") return "";
  const v = (bank as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true, role: true },
  });
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const format = req.nextUrl.searchParams.get("format") || "csv";

  const profiles = await prisma.employeeProfile.findMany({
    where: { tenantId: tenant.id, status: { not: "EXITED" } },
    orderBy: [{ status: "asc" }, { fullName: "asc" }],
  });

  const memberEmails = await prisma.membership.findMany({
    where: { tenantId: tenant.id, status: MembershipStatus.ACTIVE },
    include: { user: { select: { id: true, email: true } } },
  });
  const emailByUserId = new Map(memberEmails.map((m) => [m.user.id, m.user.email || ""]));

  const rows: EmployeeRegisterRow[] = profiles.map((p) => ({
    employeeNumber: p.employeeNumber || "",
    fullName: p.fullName || "",
    workEmail: p.workEmail || emailByUserId.get(p.userId) || "",
    department: p.department || "",
    position: p.position || "",
    status: p.status,
    dateOfJoining: p.dateOfJoining ? p.dateOfJoining.toISOString().slice(0, 10) : "",
    paygroup: p.paygroupName || "",
    grossMonthly: p.grossMonthly != null ? String(Number(p.grossMonthly)) : "",
    phone: p.phoneMobile || "",
  }));

  if (format === "json") {
    return NextResponse.json({ rows });
  }

  const csv = employeeRegisterToCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tenant.slug}-employee-register.csv"`,
    },
  });
}
