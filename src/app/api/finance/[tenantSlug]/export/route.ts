import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

function canManageFinance(
  isPlatformAdmin: boolean,
  membership: { status: MembershipStatus; role: MembershipRole } | null,
) {
  if (isPlatformAdmin) return true;
  if (!membership || membership.status !== MembershipStatus.ACTIVE) return false;
  return membership.role === MembershipRole.ORG_ADMIN || membership.role === MembershipRole.FINANCE_MANAGER;
}

function toCsv(rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [
    headers.map(esc).join(","),
    ...rows.map((row) => headers.map((h) => esc(row[h] ?? "")).join(",")),
  ].join("\n");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
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
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const kind = req.nextUrl.searchParams.get("kind") || "invoices";
  const format = req.nextUrl.searchParams.get("format") || "json";

  if (kind === "invoices") {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });
    const rows = invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      title: i.title,
      status: i.status,
      amount: Number(i.amount),
      balanceDue: Number(i.balanceDue),
      currency: i.currency,
      dueDate: i.dueDate ? i.dueDate.toISOString() : "",
      issuedAt: i.issuedAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    }));
    if (format === "csv") {
      return new NextResponse(toCsv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${tenant.slug}-invoices.csv"`,
        },
      });
    }
    return NextResponse.json({ kind, rows });
  }

  if (kind === "payments") {
    const payments = await prisma.paymentRecord.findMany({
      where: { tenantId: tenant.id },
      orderBy: { paidAt: "desc" },
      include: { invoice: { select: { invoiceNumber: true } } },
      take: 4000,
    });
    const rows = payments.map((p) => ({
      id: p.id,
      invoiceNumber: p.invoice?.invoiceNumber || p.standaloneTitle || "Direct",
      amount: Number(p.amount),
      currency: p.currency,
      paidAt: p.paidAt.toISOString(),
      method: p.method || "",
      reference: p.reference || "",
      recordedBy: p.recordedByLabel || "",
    }));
    if (format === "csv") {
      return new NextResponse(toCsv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${tenant.slug}-payments.csv"`,
        },
      });
    }
    return NextResponse.json({ kind, rows });
  }

  return NextResponse.json({ error: "Unsupported export kind." }, { status: 400 });
}
