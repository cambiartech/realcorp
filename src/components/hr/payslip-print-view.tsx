"use client";

import { BrandedDocumentShell } from "@/components/hr/branded-document-shell";
import type { PayslipCalculation } from "@/lib/hr-payslip";
import type { TenantBranding } from "@/lib/tenant-branding";

export function PayslipPrintView({
  companyName,
  brand,
  periodLabel,
  employeeName,
  jobRole,
  paygroup,
  accountNumber,
  bankName,
  employeeId,
  taxId,
  rsaPin,
  pensionAdministrator,
  currency,
  calc,
}: {
  companyName: string;
  brand?: TenantBranding | null;
  periodLabel: string;
  employeeName: string;
  jobRole: string;
  paygroup: string;
  accountNumber: string;
  bankName: string;
  employeeId: string;
  taxId?: string;
  rsaPin?: string;
  pensionAdministrator?: string;
  currency: string;
  calc: PayslipCalculation;
}) {
  const money = (n: number) =>
    `${currency} ${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const earningsRows = Array.isArray(calc.earnings) ? calc.earnings : [];
  const deductionRows = Array.isArray(calc.deductions) ? calc.deductions : [];

  const bht = earningsRows
    .filter((e) => ["B", "H", "T"].includes(e.code))
    .reduce((sum, e) => sum + e.amount, 0);

  const body = (
    <>
      <div className="mb-5 rounded-lg border-2 border-slate-800 bg-slate-50 px-4 py-3 text-center print:border-slate-900">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Net pay this period</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{money(calc.netPay)}</p>
      </div>

      <div className="mb-5 grid gap-3 rounded-md border border-slate-200 bg-slate-50/80 p-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Employee</p>
          <p className="font-semibold text-slate-900">{employeeName}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Job role</p>
          <p className="font-semibold text-slate-900">{jobRole || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Pay group</p>
          <p>{paygroup || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Employee ID</p>
          <p>{employeeId || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Bank</p>
          <p>{bankName || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Account number</p>
          <p className="font-mono text-xs">{accountNumber || "—"}</p>
        </div>
        {taxId ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">TIN</p>
            <p className="font-mono text-xs">{taxId}</p>
          </div>
        ) : null}
        {rsaPin ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">RSA PIN</p>
            <p className="font-mono text-xs">{rsaPin}</p>
            {pensionAdministrator ? <p className="text-xs text-slate-600">{pensionAdministrator}</p> : null}
          </div>
        ) : null}
      </div>

      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Earnings</p>
      <table className="mb-4 w-full border-collapse border border-slate-300 text-sm">
        <thead>
          <tr className="bg-slate-800 text-left text-white">
            <th className="border border-slate-300 px-3 py-2">Description</th>
            <th className="border border-slate-300 px-3 py-2 text-right">%</th>
            <th className="border border-slate-300 px-3 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {earningsRows.map((row) => (
            <tr key={row.code}>
              <td className="border border-slate-200 px-3 py-2">{row.label.replace(/\s*\(\d+%\)/, "")}</td>
              <td className="border border-slate-200 px-3 py-2 text-right text-slate-600">
                {row.percent == null ? "One-time" : `${row.percent}%`}
              </td>
              <td className="border border-slate-200 px-3 py-2 text-right font-medium">
                {money(row.amount)}
              </td>
            </tr>
          ))}
          <tr className="bg-slate-100 font-semibold">
            <td className="border border-slate-200 px-3 py-2" colSpan={2}>
              Total gross pay
            </td>
            <td className="border border-slate-200 px-3 py-2 text-right">{money(calc.grossPay)}</td>
          </tr>
        </tbody>
      </table>

      <p className="mb-2 text-xs text-slate-600">
        Pension is calculated on Basic + Housing + Transport (BHT): {money(bht)}
      </p>

      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Deductions</p>
      <table className="w-full border-collapse border border-slate-300 text-sm">
        <thead>
          <tr className="bg-slate-800 text-left text-white">
            <th className="border border-slate-300 px-3 py-2">Description</th>
            <th className="border border-slate-300 px-3 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {deductionRows.map((row) => (
            <tr key={row.code}>
              <td className="border border-slate-200 px-3 py-2">{row.label}</td>
              <td className="border border-slate-200 px-3 py-2 text-right font-medium">
                {money(row.amount)}
              </td>
            </tr>
          ))}
          <tr className="bg-slate-800 font-bold text-white">
            <td className="border border-slate-300 px-3 py-2">Net pay</td>
            <td className="border border-slate-300 px-3 py-2 text-right">{money(calc.netPay)}</td>
          </tr>
        </tbody>
      </table>

      {calc.employerContributions?.length ? (
        <>
          <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-slate-600">
            Employer contributions (not deducted from net)
          </p>
          <table className="w-full border-collapse border border-slate-300 text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border border-slate-300 px-3 py-2">Description</th>
                <th className="border border-slate-300 px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {calc.employerContributions.map((row) => (
                <tr key={row.code}>
                  <td className="border border-slate-200 px-3 py-2">{row.label}</td>
                  <td className="border border-slate-200 px-3 py-2 text-right font-medium">
                    {money(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {calc.appliedTaxBands?.length ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
            PAYE tax by band
          </p>
          <p className="mb-2 text-[11px] text-slate-600">
            The first ₦800,000 of annual chargeable income is untaxed. Only the amount above that
            is taxed, band by band.
            {calc.projectedAnnualChargeableIncome
              ? ` Annual chargeable: ${money(calc.projectedAnnualChargeableIncome)}.`
              : ""}
            {calc.projectedAnnualTax != null ? ` Annual PAYE: ${money(calc.projectedAnnualTax)}.` : ""}
          </p>
          <table className="w-full border-collapse border border-slate-300 text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border border-slate-300 px-3 py-2">Band</th>
                <th className="border border-slate-300 px-3 py-2 text-right">Income in band</th>
                <th className="border border-slate-300 px-3 py-2 text-right">Tax</th>
              </tr>
            </thead>
            <tbody>
              {calc.appliedTaxBands.map((band) => (
                <tr key={band.label}>
                  <td className="border border-slate-200 px-3 py-2">
                    {band.label} ({Math.round(band.rate * 100)}%)
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-right">
                    {money(band.incomeInBand)}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-right font-medium">
                    {money(band.taxInBand)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="mt-4 text-center text-[10px] text-slate-500">
        This payslip is computer-generated. Please report discrepancies to HR within 5 working days.
      </p>
    </>
  );

  if (brand) {
    return (
      <BrandedDocumentShell
        brand={brand}
        title="Salary payslip"
        subtitle={periodLabel}
        footerNote="Confidential — employee copy only"
      >
        {body}
      </BrandedDocumentShell>
    );
  }

  return (
    <div className="rounded-lg border border-foreground/15 bg-white p-6 text-black print:border-0 print:shadow-none">
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <p className="text-lg font-bold text-slate-900">{companyName}</p>
          <p className="text-sm text-slate-600">Salary payslip — {periodLabel}</p>
        </div>
        <p className="text-xs text-slate-500">Employee copy</p>
      </div>
      {body}
    </div>
  );
}
