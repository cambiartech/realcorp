"use client";

import { BrandedDocumentShell } from "@/components/hr/branded-document-shell";
import type { TenantBranding } from "@/lib/tenant-branding";

export function SalesReceiptPrintView({
  brand,
  receiptNumber,
  title,
  customerName,
  amountLabel,
  paymentMode,
  depositAccount,
  reference,
  note,
  issuedAtLabel,
  recordedBy,
  sentToEmail,
  sentAtLabel,
}: {
  brand: TenantBranding;
  receiptNumber: string;
  title: string;
  customerName: string;
  amountLabel: string;
  paymentMode: string;
  depositAccount: string;
  reference: string;
  note: string | null;
  issuedAtLabel: string;
  recordedBy: string;
  sentToEmail?: string | null;
  sentAtLabel?: string | null;
}) {
  return (
    <BrandedDocumentShell
      brand={brand}
      title="Payment receipt"
      subtitle={receiptNumber}
      footerNote="Thank you for your payment. Please retain this receipt for your records."
    >
      <div className="mb-6 rounded-xl border-2 border-[var(--hr-brand-accent)] bg-slate-50 px-5 py-4 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Amount received</p>
        <p className="mt-1 text-3xl font-bold text-slate-900">{amountLabel}</p>
      </div>

      <p className="mb-4 text-base font-semibold text-slate-900">{title}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["Customer", customerName],
          ["Date issued", issuedAtLabel],
          ["Payment mode", paymentMode],
          ["Deposit account", depositAccount],
          ["Reference", reference],
          ["Recorded by", recordedBy],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {note ? (
        <div className="mt-4 rounded-lg border border-slate-200 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Note</p>
          <p className="mt-1 text-sm text-slate-800">{note}</p>
        </div>
      ) : null}

      {sentToEmail ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
          Sent to <strong>{sentToEmail}</strong>
          {sentAtLabel ? ` · ${sentAtLabel}` : null}
        </div>
      ) : null}
    </BrandedDocumentShell>
  );
}
