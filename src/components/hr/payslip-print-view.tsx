"use client";

import { BrandedDocumentShell } from "@/components/hr/branded-document-shell";
import type { PayslipCalculation } from "@/lib/hr-payslip";
import type { TenantBranding } from "@/lib/tenant-branding";

const MONTH_FULL = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

const PENSIONABLE_EARNING_CODES = new Set(["B", "H", "T", "BASIC", "HOUSING", "TRANSPORT"]);

function payslipDocumentTitle(periodLabel: string, year?: number, month?: number) {
  if (year && month && month >= 1 && month <= 12) {
    return `${MONTH_FULL[month - 1]} ${year} PAY SLIP`;
  }
  const trimmed = periodLabel.trim();
  if (/pay\s*slip/i.test(trimmed)) return trimmed.toUpperCase();
  return `${trimmed.toUpperCase()} PAY SLIP`;
}

function formatSlipDate(value?: string | null) {
  if (!value?.trim()) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!iso) return value.trim();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${iso[3]}-${months[Number(iso[2]) - 1]}-${iso[1]}`;
}

function formatSlipAmount(n: number) {
  return n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function earningLabel(code: string, label: string) {
  const cleaned = label.replace(/\s*\(\d+%\)/, "").trim();
  if (code === "B" || code === "BASIC") return "Basic Allowance";
  if (code === "H" || code === "HOUSING") return "Housing Allowance";
  if (code === "T" || code === "TRANSPORT") return "Transportation Allowance";
  return cleaned || label;
}

function deductionLabel(code: string, label: string) {
  if (code === "PAYE") return "P.A.Y.E";
  if (code === "PENSION_EMPLOYEE" || code === "PEN") return "PENSION";
  if (code === "NHF") return "NHF";
  return label;
}

function DetailCell({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[8.75rem_minmax(0,1fr)] items-baseline gap-x-2 py-[3px] text-[13px] leading-snug">
      <span className="font-semibold text-slate-800">{label}:</span>
      <span className="min-h-[1.1em] text-slate-900">{value?.trim() ? value : "\u00a0"}</span>
    </div>
  );
}

function AmountRow({
  label,
  amount,
  variant = "plain",
}: {
  label: string;
  amount: number;
  variant?: "plain" | "gross" | "deduction" | "totalDeduction" | "net";
}) {
  const isDeduction = variant === "deduction" || variant === "totalDeduction";
  const formatted = isDeduction ? `(${formatSlipAmount(amount)})` : formatSlipAmount(amount);
  return (
    <div
      className={[
        "grid grid-cols-[minmax(0,1fr)_9rem] items-baseline gap-4 py-[3px] text-[13px]",
        variant === "gross" || variant === "net" || variant === "totalDeduction" ? "font-bold" : "",
      ].join(" ")}
    >
      <span className="text-slate-800">{label}</span>
      <span
        className={[
          "text-right tabular-nums",
          isDeduction ? "text-red-600 print:text-red-700" : "text-slate-900",
        ].join(" ")}
      >
        {formatted}
      </span>
    </div>
  );
}

export function PayslipPrintView({
  companyName,
  brand,
  periodLabel,
  year,
  month,
  employeeName,
  jobRole,
  paygroup,
  accountNumber,
  bankName,
  employeeId,
  taxId,
  rsaPin,
  pensionAdministrator,
  nhfMembershipNumber,
  location,
  hireDate,
  currency,
  calc,
}: {
  companyName: string;
  brand?: TenantBranding | null;
  periodLabel: string;
  year?: number;
  month?: number;
  employeeName: string;
  jobRole: string;
  paygroup: string;
  accountNumber: string;
  bankName: string;
  employeeId: string;
  taxId?: string;
  rsaPin?: string;
  pensionAdministrator?: string;
  nhfMembershipNumber?: string;
  location?: string;
  hireDate?: string;
  currency: string;
  calc: PayslipCalculation;
}) {
  const money = (n: number) =>
    `${currency} ${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const earningsRows = Array.isArray(calc.earnings) ? calc.earnings : [];
  const deductionRows = Array.isArray(calc.deductions) ? calc.deductions : [];
  const title = payslipDocumentTitle(periodLabel, year, month);
  const grade = jobRole.trim() || paygroup.trim();
  const totalDeductions = deductionRows.reduce((sum, row) => sum + row.amount, 0);

  const bht = earningsRows
    .filter((e) => PENSIONABLE_EARNING_CODES.has(e.code))
    .reduce((sum, e) => sum + e.amount, 0);

  const details = (
    <div className="mb-6 grid gap-x-10 sm:grid-cols-2">
      <div>
        <DetailCell label="Employee ID" value={employeeId} />
        <DetailCell label="Name" value={employeeName} />
        <DetailCell label="Grade" value={grade} />
        <DetailCell label="Bank Name" value={bankName} />
        <DetailCell label="Pension Provider" value={pensionAdministrator} />
        <DetailCell label="Location" value={location} />
        <DetailCell label="Hire Date" value={formatSlipDate(hireDate)} />
      </div>
      <div>
        <DetailCell label="Tax Id" value={taxId} />
        <DetailCell label="NHF Number" value={nhfMembershipNumber} />
        <DetailCell label="Account Number" value={accountNumber} />
        <DetailCell label="Pension No" value={rsaPin} />
      </div>
    </div>
  );

  const amounts = (
    <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] gap-x-4">
      <p className="pt-1 text-[13px] font-semibold text-slate-800">Allowances</p>
      <div>
        {earningsRows.map((row) => (
          <AmountRow key={row.code} label={earningLabel(row.code, row.label)} amount={row.amount} />
        ))}
        <AmountRow label="Gross Earnings" amount={calc.grossPay} variant="gross" />
      </div>
      <p className="pt-5 text-[13px] font-semibold text-slate-800">Deductions</p>
      <div className="pt-5">
        {deductionRows.map((row) => (
          <AmountRow
            key={row.code}
            label={deductionLabel(row.code, row.label)}
            amount={row.amount}
            variant="deduction"
          />
        ))}
        <AmountRow label="Total Deduction" amount={totalDeductions} variant="totalDeduction" />
        <div className="mt-4">
          <AmountRow label="NET PAY" amount={calc.netPay} variant="net" />
        </div>
      </div>
    </div>
  );

  const notes = (
    <div className="mt-8 border-t border-slate-300/70 pt-4 text-[11px] text-slate-600">
      <p>
        Pension is calculated on Basic + Housing + Transport (BHT): {money(bht)}
      </p>
      {calc.employerContributions?.length ? (
        <div className="mt-3">
          <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
            Employer contributions (not deducted from net)
          </p>
          {calc.employerContributions.map((row) => (
            <p key={row.code}>
              {row.label}: {money(row.amount)}
            </p>
          ))}
        </div>
      ) : null}
      {calc.appliedTaxBands?.length ? (
        <div className="mt-3">
          <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">PAYE tax by band</p>
          <p className="mb-1">
            The first ₦800,000 of annual chargeable income is untaxed.
            {calc.projectedAnnualChargeableIncome
              ? ` Annual chargeable: ${money(calc.projectedAnnualChargeableIncome)}.`
              : ""}
            {calc.projectedAnnualTax != null ? ` Annual PAYE: ${money(calc.projectedAnnualTax)}.` : ""}
          </p>
          {calc.appliedTaxBands.map((band) => (
            <p key={band.label}>
              {band.label} ({Math.round(band.rate * 100)}%): {money(band.taxInBand)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );

  const body = (
    <>
      {details}
      {amounts}
      {notes}
    </>
  );

  if (brand) {
    return (
      <BrandedDocumentShell
        brand={brand}
        title={title}
        variant="letterhead"
        footerNote="This payslip is computer-generated. Please report discrepancies to HR within 5 working days."
      >
        {body}
      </BrandedDocumentShell>
    );
  }

  return (
    <div
      data-pdf-document="true"
      className="rounded-none border border-slate-200 bg-[#ececec] p-8 text-black print:border-0 print:bg-[#ececec] print:shadow-none"
    >
      <div className="mb-2">
        <p className="text-lg font-bold uppercase tracking-wide text-slate-900">{companyName}</p>
      </div>
      <h1 className="mb-6 text-center text-[15px] font-bold uppercase tracking-wide text-slate-900 underline decoration-slate-800 decoration-1 underline-offset-[6px]">
        {title}
      </h1>
      {body}
    </div>
  );
}
