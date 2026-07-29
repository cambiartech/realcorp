import prisma from "@/lib/db";
import { formatEnumLabel } from "@/lib/ui-format";
import { isActiveFolioStatus } from "@/lib/shortlets-reservation-status";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { computeAdr, computeOccupancyPercent } from "@/lib/shortlets-analytics";
import { loadInHouseGuests, parseNightAuditSnapshot } from "@/lib/shortlets-night-audit";
import { ReportsWorkspace } from "./reports-workspace";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>;
}) {
  const { tenantSlug } = await params;
  const sp = await searchParams;
  const ctx = await loadShortletsContext(tenantSlug);
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);
  const from = sp.from || defaultFrom;
  const to = sp.to || defaultTo;
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59`);
  const tab = sp.tab === "in-house" || sp.tab === "night-audit" ? sp.tab : "performance";

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { name: true },
  });

  const [units, reservations, payments, folioLines, businessDays, inHouseReservations] = await Promise.all([
    prisma.shortletUnit.findMany({
      where: { tenantId: ctx.tenant.id },
      select: { housekeepingStatus: true },
    }),
    prisma.shortletReservation.findMany({
      where: { tenantId: ctx.tenant.id },
      select: {
        status: true,
        nights: true,
        totalAmount: true,
        checkIn: true,
        checkOut: true,
        balanceDue: true,
      },
    }),
    prisma.shortletPayment.findMany({
      where: { tenantId: ctx.tenant.id, paidAt: { gte: fromDate, lte: toDate } },
      select: { amount: true, paidAt: true },
    }),
    prisma.shortletFolioLine.findMany({
      where: { tenantId: ctx.tenant.id, postedAt: { gte: fromDate, lte: toDate } },
      select: { department: true, amount: true, currency: true },
    }),
    prisma.shortletBusinessDay.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { businessDate: "desc" },
      take: 30,
    }),
    prisma.shortletReservation.findMany({
      where: { tenantId: ctx.tenant.id, status: "CHECKED_IN" },
      include: { unit: { select: { name: true } } },
      orderBy: { checkIn: "asc" },
    }),
  ]);

  const currency = ctx.tenant.defaultCurrency;
  const occupancy = computeOccupancyPercent(units);
  const adr = computeAdr(reservations, currency);
  const totalRevenue = await prisma.shortletPayment.aggregate({
    where: { tenantId: ctx.tenant.id },
    _sum: { amount: true },
  });
  const periodRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = reservations
    .filter((r) => r.status !== "CANCELLED" && r.status !== "CHECKED_OUT")
    .reduce((s, r) => s + Number(r.balanceDue), 0);
  const activeReservations = reservations.filter((r) => isActiveFolioStatus(r.status)).length;

  const deptMap = new Map<string, number>();
  for (const line of folioLines) {
    const key = formatEnumLabel(line.department);
    deptMap.set(key, (deptMap.get(key) || 0) + Number(line.amount));
  }

  return (
    <ReportsWorkspace
      tenantSlug={ctx.tenant.slug}
      tenantName={tenant?.name || ctx.tenant.slug}
      tab={tab}
      from={from}
      to={to}
      currency={currency}
      occupancyLabel={`${occupancy}%`}
      adrLabel={adr.label}
      totalUnits={units.length}
      activeReservations={activeReservations}
      periodRevenueLabel={`${currency} ${periodRevenue.toLocaleString()}`}
      totalRevenueLabel={`${currency} ${Number(totalRevenue._sum.amount || 0).toLocaleString()}`}
      outstandingLabel={`${currency} ${outstanding.toLocaleString()}`}
      folioByDept={Array.from(deptMap.entries()).map(([department, total]) => ({
        department,
        totalLabel: `${currency} ${total.toLocaleString()}`,
      }))}
      inHouseGuests={loadInHouseGuests(
        inHouseReservations.map((r) => ({ ...r, currency: r.currency })),
        currency,
      )}
      nightAuditHistory={businessDays.map((d) => {
        const snap = parseNightAuditSnapshot(d.snapshot);
        return {
          id: d.id,
          dateLabel: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(d.businessDate),
          closedAtLabel: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(
            d.closedAt,
          ),
          occupancy: snap ? `${snap.summary.occupancyPercent}%` : "—",
          adr: snap ? snap.summary.adrLabel : "—",
          inHouse: snap ? String(snap.summary.inHouseCount) : "—",
          snapshot: snap,
        };
      })}
    />
  );
}
