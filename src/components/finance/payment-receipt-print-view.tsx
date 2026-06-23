"use client";

import type { TenantBranding } from "@/lib/tenant-branding";
import {
  FinanceAmountHero,
  FinanceDetailGrid,
  FinanceDocumentShell,
  FinanceMetaGrid,
} from "@/components/finance/finance-document-shell";

export function PaymentReceiptPrintView({
  brand,
  receiptNumber,
  title,
  customerName,
  amountLabel,
  paidAtLabel,
  paymentMode,
  reference,
  recordedBy,
  invoiceBalanceLabel,
  attachmentName,
  attachmentUrl,
}: {
  brand: TenantBranding;
  receiptNumber: string;
  title: string;
  customerName: string;
  amountLabel: string;
  paidAtLabel: string;
  paymentMode: string;
  reference: string;
  recordedBy: string;
  invoiceBalanceLabel?: string | null;
  attachmentName?: string | null;
  attachmentUrl?: string | null;
}) {
  return (
    <FinanceDocumentShell
      brand={brand}
      documentLabel="Payment receipt"
      documentNumber={receiptNumber}
      footerNote="Thank you for your payment. Please retain this receipt for your records."
    >
      <FinanceMetaGrid
        rows={[
          { label: "Paid on", value: paidAtLabel },
          { label: "From", value: brand.companyName },
          { label: "Received from", value: customerName, wide: true },
        ]}
      />

      <FinanceAmountHero label="Amount received" amount={amountLabel} />

      <p className="mb-4 text-base font-semibold text-neutral-900">{title}</p>

      <FinanceDetailGrid
        items={[
          { label: "Customer / payer", value: customerName },
          { label: "Paid on", value: paidAtLabel },
          { label: "Payment mode", value: paymentMode },
          { label: "Reference", value: reference },
          { label: "Recorded by", value: recordedBy },
          ...(invoiceBalanceLabel ? [{ label: "Invoice balance remaining", value: invoiceBalanceLabel }] : []),
        ]}
      />

      {attachmentUrl ? (
        <p className="mt-4 text-sm text-neutral-600">
          Attachment:{" "}
          <a href={attachmentUrl} target="_blank" rel="noreferrer" className="font-medium text-neutral-900 underline">
            {attachmentName || "View attachment"}
          </a>
        </p>
      ) : null}
    </FinanceDocumentShell>
  );
}
