"use client";

import Link from "next/link";
import { ArrowRight, Banknote, FileCheck, Landmark, Send, Wallet } from "lucide-react";

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
      title: "Setup people",
      body:
        payrollReadyCount > 0
          ? `${payrollReadyCount} ready (ACTIVE + gross + bank on People).`
          : "Set gross, bank code, and ACTIVE on People → Job & Bank.",
      link: payrollReadyCount === 0 ? `/${tenantSlug}/hr/people` : undefined,
      linkLabel: "Open People",
      done: payrollReadyCount > 0,
    },
    {
      icon: Wallet,
      title: "Fund float",
      body: "Copy the payroll account above, transfer, submit the reference. Balance rises after Realcorp verifies.",
      done: false,
    },
    {
      icon: Send,
      title: "Generate & publish",
      body:
        periodStatus === "none"
          ? `Generate ${periodLabel ?? "the month"}, review, then publish.`
          : periodStatus === "DRAFT"
            ? `${periodLabel}: ${periodSlipCount} draft — adjust if needed, then publish.`
            : `${periodLabel}: published · ${periodSlipCount} slip${periodSlipCount === 1 ? "" : "s"}.`,
      done: periodStatus === "FINALIZED",
    },
    {
      icon: Banknote,
      title: "Pay staff",
      body:
        periodStatus === "FINALIZED"
          ? periodPaidCount >= periodSlipCount && periodSlipCount > 0
            ? `All ${periodPaidCount} marked paid.`
            : `${periodPaidCount}/${periodSlipCount} paid — Pay via Paystack or mark paid manually.`
          : "After publish: Pay via Paystack (auto) or mark paid after bank transfer.",
      done: periodStatus === "FINALIZED" && periodSlipCount > 0 && periodPaidCount >= periodSlipCount,
    },
    {
      icon: Landmark,
      title: "Remittances",
      body: "Export PAYE, pension, NHF, NSITF for the same month.",
      link: `/${tenantSlug}/hr/remittances`,
      linkLabel: "Open remittances",
      done: false,
    },
  ];

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Payroll path
          </p>
          <p className="mt-0.5 text-sm text-muted">Follow in order — float first, then pay.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {steps.map((s, i) => (
          <div
            key={s.title}
            className={[
              "relative rounded-xl border p-3.5",
              s.done
                ? "border-[var(--success-line)] bg-[var(--success-wash)]/40"
                : "border-foreground/10 bg-foreground/[0.02]",
            ].join(" ")}
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold",
                  s.done ? "bg-[var(--success)] text-white" : "bg-foreground/10 text-foreground",
                ].join(" ")}
              >
                {i + 1}
              </span>
              <s.icon className="h-3.5 w-3.5 text-muted" />
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
    </div>
  );
}
