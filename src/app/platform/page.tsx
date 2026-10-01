import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { MembershipStatus, PayrollDisbursementBatchStatus } from "@/generated/prisma";
import { PlatformTenantTable, type PlatformTenantRow } from "./platform-tenant-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tenants · Platform",
};

function moneyLabel(value: { toString(): string } | string | number | null | undefined) {
  const n = Number(value == null ? 0 : typeof value === "object" ? value.toString() : value);
  return Number.isFinite(n)
    ? n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";
}

export default async function PlatformHomePage() {
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) {
    redirect("/login?callbackUrl=/platform");
  }

  const [tenants, waitingApproval] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { name: "asc" },
      include: {
        payrollTenantBalance: { select: { availableBalance: true } },
        _count: {
          select: {
            memberships: { where: { status: MembershipStatus.ACTIVE } },
            invitations: { where: { acceptedAt: null } },
          },
        },
      },
    }),
    prisma.payrollDisbursementBatch.count({
      where: { status: PayrollDisbursementBatchStatus.DRAFT, startedAt: null },
    }),
  ]);

  const rows: PlatformTenantRow[] = tenants.map((tenant) => ({
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status,
    plan: tenant.plan,
    createdLabel: tenant.createdAt.toISOString().slice(0, 10),
    memberCount: tenant._count.memberships,
    pendingInvites: tenant._count.invitations,
    availableLabel: moneyLabel(tenant.payrollTenantBalance?.availableBalance),
    currency: tenant.defaultCurrency || "NGN",
  }));

  const active = tenants.filter((tenant) => tenant.status === "ACTIVE").length;
  const pendingInvites = rows.reduce((sum, row) => sum + row.pendingInvites, 0);

  const cards = [
    { label: "Organizations", value: String(tenants.length), href: "/platform" },
    { label: "Active", value: String(active), href: "/platform" },
    { label: "Open invites", value: String(pendingInvites), href: "/platform" },
    { label: "Payroll waiting", value: String(waitingApproval), href: "/platform/payroll" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tenants</h1>
          <p className="mt-1 text-sm text-muted">Every organization on Realcorp. Open one to change its payroll fees.</p>
        </div>
        <Link
          href="/platform/onboarding"
          className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
        >
          Onboard organization
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-lg border border-foreground/10 px-4 py-3 hover:bg-foreground/[0.03]"
          >
            <p className="text-xs uppercase tracking-wide text-muted">{card.label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-foreground">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <PlatformTenantTable rows={rows} />
      </div>
    </div>
  );
}
