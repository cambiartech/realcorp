import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { HrPayslipPaymentStatus, HrPayslipRunStatus, PayrollFundingStatus } from "@/generated/prisma";
import { getAvailableBalanceNaira } from "@/lib/payroll/disbursement";
import {
  PlatformPayrollTestLab,
  type PlatformDisburseRunOption,
} from "./payroll-test-lab";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Payroll float · Platform",
};

export default async function PlatformPayrollPage() {
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) {
    redirect("/login?callbackUrl=/platform/payroll");
  }

  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    take: 100,
    select: {
      id: true,
      name: true,
      slug: true,
      defaultCurrency: true,
      settings: { select: { payrollDisbursementSettings: true } },
      payrollFundingReceipts: {
        where: { status: PayrollFundingStatus.PENDING },
        select: { id: true },
      },
    },
  });

  const { parsePayrollDisbursementSettings, tenantHasDedicatedVirtualAccount } = await import(
    "@/lib/payroll/disbursement"
  );

  const rows = await Promise.all(
    tenants.map(async (t) => {
      const availableLabel = await getAvailableBalanceNaira(prisma, t.id);
      const disbursement = parsePayrollDisbursementSettings(t.settings?.payrollDisbursementSettings);
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        currency: t.defaultCurrency || "NGN",
        availableLabel,
        pendingCount: t.payrollFundingReceipts.length,
        hasDva: tenantHasDedicatedVirtualAccount(disbursement),
        dvaAccountNumber: disbursement.dvaAccountNumber || "",
      };
    }),
  );

  const pendingTotal = rows.reduce((sum, r) => sum + r.pendingCount, 0);

  const readyRunsRaw = await prisma.hrPayslipRun.findMany({
    where: {
      status: HrPayslipRunStatus.FINALIZED,
      payslips: { some: { paymentStatus: HrPayslipPaymentStatus.PENDING } },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: 40,
    select: {
      id: true,
      label: true,
      tenantId: true,
      tenant: { select: { name: true, slug: true, defaultCurrency: true } },
      payslips: {
        where: { paymentStatus: HrPayslipPaymentStatus.PENDING },
        select: { id: true },
      },
    },
  });

  const balanceByTenant = new Map(rows.map((r) => [r.id, r.availableLabel]));
  const disburseRuns: PlatformDisburseRunOption[] = readyRunsRaw.map((r) => ({
    tenantSlug: r.tenant.slug,
    tenantName: r.tenant.name,
    runId: r.id,
    label: r.label,
    pendingCount: r.payslips.length,
    availableLabel: balanceByTenant.get(r.tenantId) || "0.00",
    currency: r.tenant.defaultCurrency || "NGN",
  }));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-foreground">Payroll float</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Fund → verify → Available on the ledger. Phase 1 Paystack payouts debit that balance and
        send salaries. Use the test lab below as Super Admin.
      </p>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted">Organizations</p>
          <p className="mt-0.5 font-semibold tabular-nums text-foreground">{rows.length}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted">Pending claims</p>
          <p className="mt-0.5 font-semibold tabular-nums text-foreground">{pendingTotal}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted">Ready to disburse</p>
          <p className="mt-0.5 font-semibold tabular-nums text-foreground">{disburseRuns.length}</p>
        </div>
      </div>

      <div className="mt-8 overflow-hidden border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">Available</th>
              <th className="px-4 py-3">DVA</th>
              <th className="px-4 py-3">Pending claims</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted">
                  No organizations yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-foreground/5 transition-colors hover:bg-foreground/[0.02]"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{r.name}</p>
                    <p className="font-mono text-[11px] text-muted">/{r.slug}</p>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-foreground">
                    {r.currency} {r.availableLabel}
                  </td>
                  <td className="px-4 py-3">
                    {r.hasDva ? (
                      <span className="font-mono text-[11px] text-foreground" title={r.dvaAccountNumber}>
                        Linked
                      </span>
                    ) : (
                      <span className="text-xs text-muted">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.pendingCount > 0 ? (
                      <span className="rounded-full border border-[var(--warn-line)] bg-[var(--warn-wash)] px-2 py-0.5 text-xs font-semibold text-foreground">
                        {r.pendingCount} to verify
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/platform/tenants/${r.slug}#payroll-float`}
                      className="text-xs font-semibold text-foreground underline underline-offset-2"
                    >
                      {r.hasDva ? "Edit float / DVA →" : "Add DVA →"}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PlatformPayrollTestLab appUrl={appUrl} runs={disburseRuns} />
    </div>
  );
}
