"use client";

import type { TenantBranding } from "@/lib/tenant-branding";
import {
  FinanceAmountHero,
  FinanceDetailGrid,
  FinanceDocumentShell,
  FinanceMetaGrid,
  FinanceNotesBlock,
} from "@/components/finance/finance-document-shell";

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
    <FinanceDocumentShell
      brand={brand}
      documentLabel="Sales receipt"
      documentNumber={receiptNumber}
      footerNote="Thank you for your payment. Please retain this receipt for your records."
    >
      <FinanceMetaGrid
        rows={[
          { label: "Issue date", value: issuedAtLabel },
          { label: "From", value: brand.companyName },
          { label: "To", value: customerName, wide: true },
        ]}
      />

      <FinanceAmountHero label="Amount received" amount={amountLabel} />

      <p className="mb-4 text-base font-semibold text-neutral-900">{title}</p>

      <FinanceDetailGrid
        items={[
          { label: "Customer", value: customerName },
          { label: "Date issued", value: issuedAtLabel },
          { label: "Payment mode", value: paymentMode },
          { label: "Deposit account", value: depositAccount },
          { label: "Reference", value: reference },
          { label: "Recorded by", value: recordedBy },
        ]}
      />

      {note ? (
        <FinanceNotesBlock>
          <p>{note}</p>
        </FinanceNotesBlock>
      ) : null}

      {sentToEmail ? (
        <FinanceNotesBlock title="Delivery">
          <p>
            Sent to <strong>{sentToEmail}</strong>
            {sentAtLabel ? ` · ${sentAtLabel}` : null}
          </p>
        </FinanceNotesBlock>
      ) : null}
    </FinanceDocumentShell>
  );
}
