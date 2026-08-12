"use client";

import Link from "next/link";
import { ArrowRight, Banknote, FileCheck, Send } from "lucide-react";

export function PayrollWorkflowGuide({
  tenantSlug,
  payrollReadyCount,
  periodLabel,
  periodSlipCount,
  periodStatus,
  periodPaidCount,
}: {
  tenantSlug: string;
  payrollReadyCount: number;
  periodLabel: string | null;
  periodSlipCount: number;
  periodStatus: "none" | "DRAFT" | "FINALIZED";
  periodPaidCount: number;
}) {
  const steps = [
    {
      icon: FileCheck,
      title: "1. Setup",
      body:
        payrollReadyCount > 0
          ? `${payrollReadyCount} employee${payrollReadyCount === 1 ? "" : "s"} ready (ACTIVE + monthly gross on People → Job).`
          : "No one ready yet — set gross pay on People → Job and mark profiles ACTIVE.",
      link: payrollReadyCount === 0 ? `/${tenantSlug}/hr/people` : undefined,
      linkLabel: "Open People",
    },
    {
      icon: Send,
      title: "2. Generate, adjust & publish",
      body:
        periodStatus === "none"
          ? `Generate ${periodLabel ?? "the month"}, add any one-time bonuses or deductions, then publish after review.`
          : periodStatus === "DRAFT"
            ? `${periodLabel}: ${periodSlipCount} draft slip${periodSlipCount === 1 ? "" : "s"} — use Adjust for bonuses, reimbursements or deductions before publishing.`
            : `${periodLabel}: published — ${periodSlipCount} slip${periodSlipCount === 1 ? "" : "s"} visible to employees.`,
    },
    {
      icon: Banknote,
      title: "3. Mark salary paid",
      body:
        periodStatus === "FINALIZED"
          ? periodPaidCount >= periodSlipCount && periodSlipCount > 0
            ? `All ${periodPaidCount} bank transfers recorded for this month.`
            : periodSlipCount > 0
              ? `${periodPaidCount} of ${periodSlipCount} marked paid — use the table after you pay each person (or bulk mark).`
              : "After publishing, record bank payments here. This is separate from publishing the payslip PDF."
          : "After you publish, mark each row Paid once salary hits their bank account.",
    },
  ];

  return (
    <div className="rounded-xl border border-foreground/10 bg-gradient-to-br from-foreground/[0.03] to-transparent p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">How payroll works</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.title} className="rounded-lg border border-foreground/10 bg-foreground/[0.02]/80 p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <s.icon className="h-4 w-4 text-muted" />
              <span className="text-sm font-semibold text-foreground">{s.title}</span>
            </div>
            <p className="text-xs leading-relaxed text-muted">{s.body}</p>
            {s.link ? (
              <Link
                href={s.link}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-foreground underline"
              >
                {s.linkLabel}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted">
        <strong className="text-foreground">Published</strong> = employee can download the payslip.{" "}
        <strong className="text-foreground">Paid</strong> = you confirm the net salary was transferred
        (manual; no bank API).
      </p>
    </div>
  );
}
