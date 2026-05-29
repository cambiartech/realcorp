"use client";

import { Printer } from "lucide-react";
import { SalesReceiptPrintView } from "@/components/finance/sales-receipt-print-view";
import type { TenantBranding } from "@/lib/tenant-branding";

export function SalesReceiptPrintClient(props: {
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
    <>
      <div className="mb-4 flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
        >
          <Printer className="h-3.5 w-3.5" />
          Print / Save PDF
        </button>
      </div>
      <SalesReceiptPrintView {...props} />
    </>
  );
}
