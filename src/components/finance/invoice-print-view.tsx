"use client";

import type { TenantBranding } from "@/lib/tenant-branding";
import {
  FinanceDocumentShell,
  FinanceLineTable,
  FinanceMetaGrid,
  FinanceNotesBlock,
} from "@/components/finance/finance-document-shell";

export function InvoicePrintView({
  brand,
  invoiceNumber,
  title,
  customerName,
  amountLabel,
  balanceLabel,
  issuedAtLabel,
  dueDateLabel,
  department,
  paymentInstructions,
  isReminder,
  sentToEmail,
  sentAtLabel,
}: {
  brand: TenantBranding;
  invoiceNumber: string;
  title: string;
  customerName: string;
  amountLabel: string;
  balanceLabel: string;
  issuedAtLabel: string;
  dueDateLabel: string;
  department?: string | null;
  paymentInstructions: string[];
  isReminder?: boolean;
  sentToEmail?: string | null;
  sentAtLabel?: string | null;
}) {
  return (
    <FinanceDocumentShell
      brand={brand}
      documentLabel={isReminder ? "Payment reminder" : "Invoice"}
      documentNumber={invoiceNumber}
      footerNote="Thank you for your business."
    >
      <FinanceMetaGrid
        rows={[
          { label: "Issue date", value: issuedAtLabel },
          { label: "Due date", value: dueDateLabel },
          { label: "From", value: brand.companyName },
          { label: "Bill to", value: customerName, wide: true },
        ]}
      />

      <FinanceLineTable
        columns={[
          { key: "item", label: "Item" },
          { key: "qty", label: "Qty", align: "right" },
          { key: "unit", label: "Unit price", align: "right" },
          { key: "total", label: "Total", align: "right" },
        ]}
        rows={[
          {
            item: title,
            qty: "1",
            unit: amountLabel,
            total: amountLabel,
          },
        ]}
        totals={[
          { label: "Subtotal", value: amountLabel },
          { label: "Balance due", value: balanceLabel, emphasis: true },
        ]}
      />

      {department ? (
        <FinanceNotesBlock title="Department">
          <p>{department}</p>
        </FinanceNotesBlock>
      ) : null}

      {paymentInstructions.length > 0 ? (
        <FinanceNotesBlock title="How to pay">
          <ul className="list-disc space-y-1 pl-4">
            {paymentInstructions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </FinanceNotesBlock>
      ) : null}

      {isReminder ? (
        <FinanceNotesBlock title="Reminder">
          <p>This is a friendly reminder that payment is outstanding.</p>
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
