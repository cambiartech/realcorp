"use client";

import { useMemo } from "react";
import { previewMonthlyPay } from "@/lib/hr-pay-preview";
import type { ProfileDetailRow } from "@/lib/hr-profile-form";

function money(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function Line({ label, amount, currency }: { label: string; amount: number; currency: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums text-foreground">{money(currency, amount)}</span>
    </div>
  );
}

export function MonthlyPayCard({
  profile,
  currency,
}: {
  profile: ProfileDetailRow;
  currency: string;
}) {
  const pay = useMemo(
    () =>
      previewMonthlyPay({
        grossMonthly: profile.grossMonthly,
        payrollCountryCode: profile.payrollCountryCode,
        basicPercent: profile.basicPercent,
        housingPercent: profile.housingPercent,
        transportPercent: profile.transportPercent,
        otherPercent: profile.otherPercent,
        pensionEnabled: profile.pensionEnabled,
        employeePensionRate: profile.employeePensionRate,
        employerPensionRate: profile.employerPensionRate,
        nhfMonthly: profile.nhfMonthly,
        nhiaMonthly: profile.nhiaMonthly,
        annualRent: profile.annualRent,
        annualLifeInsurance: profile.annualLifeInsurance,
        annualMortgageInterest: profile.annualMortgageInterest,
        otherPreTaxMonthly: profile.otherPreTaxMonthly,
        otherPostTaxMonthly: profile.otherPostTaxMonthly,
        payeeTaxMonthly: profile.payeeTaxMonthly,
        taxOverrideReason: profile.taxOverrideReason,
      }),
    [profile],
  );

  if (!pay) {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-background px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Pay</p>
        <p className="mt-2 text-sm text-muted">Not set yet</p>
      </div>
    );
  }

  const deductionTotal = pay.deductions.reduce((sum, line) => sum + line.amount, 0);

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Take-home</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {money(currency, pay.netPay)}
          </p>
          <p className="mt-1 text-sm text-muted">Gross {money(currency, pay.grossPay)} a month</p>
        </div>
        <p className="text-sm tabular-nums text-muted">Deductions {money(currency, deductionTotal)}</p>
      </div>
      <div className="mt-5 grid gap-6 border-t border-foreground/10 pt-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-foreground">Earnings</p>
          <div className="mt-1">
            {pay.earnings.map((line) => (
              <Line key={line.code} label={line.label} amount={line.amount} currency={currency} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">Deductions</p>
          <div className="mt-1">
            {pay.deductions.map((line) => (
              <Line key={line.code} label={line.label} amount={line.amount} currency={currency} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
