import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { formatEnumLabel } from "@/lib/ui-format";
import { notFound } from "next/navigation";
import { ShortletsWorkspace } from "./shortlets-workspace";

export const dynamic = "force-dynamic";

function canManageShortLets(
  isPlatformAdmin: boolean,
  membership: { status: MembershipStatus; role: MembershipRole } | null,
) {
  if (isPlatformAdmin) return true;
  if (!membership || membership.status !== MembershipStatus.ACTIVE) return false;
  return (
    membership.role === MembershipRole.ORG_ADMIN ||
    membership.role === MembershipRole.SALES_MANAGER ||
    membership.role === MembershipRole.FINANCE_MANAGER
  );
}

export default async function ShortLetsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      slug: true,
      defaultCurrency: true,
      settings: {
        select: {
          moduleSales: true,
          moduleFinance: true,
          moduleMarketing: true,
          moduleCommunity: true,
          moduleShortLets: true,
          roleModuleGrants: true,
        },
      },
    },
  });
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true, role: true },
  });
  assertTenantNavAccess(session, membership, tenant.settings, "shortlets");

  const canManage = canManageShortLets(Boolean(session.user.isPlatformAdmin), membership);

  const [units, reservations, payments, projectUnits] = await Promise.all([
    prisma.shortletUnit.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      include: {
        activeReservation: {
          select: { id: true, guestName: true, checkIn: true, checkOut: true, balanceDue: true, status: true },
        },
        projectUnit: {
          select: {
            id: true,
            label: true,
            unitType: true,
            project: { select: { name: true } },
          },
        },
      },
    }),
    prisma.shortletReservation.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      include: {
        unit: { select: { name: true } },
      },
      take: 300,
    }),
    prisma.shortletPayment.findMany({
      where: { tenantId: tenant.id },
      orderBy: { paidAt: "desc" },
      include: { reservation: { select: { guestName: true } } },
      take: 300,
    }),
    prisma.unit.findMany({
      where: { tenantId: tenant.id, shortletUnit: null },
      select: { id: true, label: true, unitType: true, status: true, project: { select: { name: true } } },
      orderBy: [{ project: { name: "asc" } }, { label: "asc" }],
      take: 500,
    }),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const activeReservations = reservations.filter((r) => r.status === "RESERVED" || r.status === "CHECKED_IN");
  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const monthRevenue = payments
    .filter((p) => p.paidAt >= monthStart)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalOutstanding = reservations
    .filter((r) => r.status !== "CANCELLED")
    .reduce((sum, r) => sum + Number(r.balanceDue), 0);

  return (
    <ShortletsWorkspace
      tenantSlug={tenant.slug}
      defaultCurrency={tenant.defaultCurrency}
      canManage={canManage}
      analytics={{
        totalUnits: units.length,
        occupiedUnits: units.filter((u) => u.status === "OCCUPIED").length,
        activeReservations: activeReservations.length,
        totalRevenueLabel: `${tenant.defaultCurrency} ${totalRevenue.toLocaleString()}`,
        monthRevenueLabel: `${tenant.defaultCurrency} ${monthRevenue.toLocaleString()}`,
        outstandingLabel: `${tenant.defaultCurrency} ${totalOutstanding.toLocaleString()}`,
      }}
      units={units.map((u) => ({
        id: u.id,
        name: u.name,
        location: u.location || "—",
        nightlyRateLabel: `${u.currency} ${Number(u.nightlyRate).toLocaleString()}`,
        cleaningFeeLabel: `${u.currency} ${Number(u.cleaningFee || 0).toLocaleString()}`,
        status: formatEnumLabel(u.status),
        linkedProjectUnitLabel: u.projectUnit
          ? `${u.projectUnit.project.name} · ${u.projectUnit.label}${u.projectUnit.unitType ? ` (${u.projectUnit.unitType})` : ""}`
          : null,
        activeReservation:
          u.activeReservation
            ? `${u.activeReservation.guestName} · ${new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(u.activeReservation.checkIn)} - ${new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(u.activeReservation.checkOut)}`
            : "None",
      }))}
      reservations={reservations.map((r) => ({
        id: r.id,
        unitId: r.unitId,
        unitName: r.unit.name,
        guestName: r.guestName,
        stayLabel: `${new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(r.checkIn)} - ${new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(r.checkOut)}`,
        nights: r.nights,
        totalAmountLabel: `${r.currency} ${Number(r.totalAmount).toLocaleString()}`,
        paidAmountLabel: `${r.currency} ${Number(r.amountPaid).toLocaleString()}`,
        balanceLabel: `${r.currency} ${Number(r.balanceDue).toLocaleString()}`,
        status: formatEnumLabel(r.status),
      }))}
      payments={payments.map((p) => ({
        id: p.id,
        guestName: p.reservation.guestName,
        amountLabel: `${p.currency} ${Number(p.amount).toLocaleString()}`,
        paidAtLabel: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(p.paidAt),
        method: p.method || "—",
        reference: p.reference || "—",
      }))}
      unitOptions={units.map((u) => ({ id: u.id, label: `${u.name} (${u.status.toLowerCase()})` }))}
      projectUnitOptions={projectUnits.map((u) => ({
        id: u.id,
        label: `${u.project.name} · ${u.label}${u.unitType ? ` (${u.unitType})` : ""} · ${formatEnumLabel(u.status)}`,
      }))}
      reservationOptions={reservations
        .filter((r) => r.status !== "CANCELLED" && r.status !== "CHECKED_OUT")
        .map((r) => ({ id: r.id, label: `${r.guestName} - ${r.unit.name}` }))}
    />
  );
}
