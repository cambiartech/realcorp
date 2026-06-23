"use client";

import { Printer } from "lucide-react";
import { PaymentReceiptPrintView } from "@/components/finance/payment-receipt-print-view";
import type { TenantBranding } from "@/lib/tenant-branding";

export function PaymentReceiptPrintClient(props: {
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
      <PaymentReceiptPrintView {...props} />
    </>
  );
}
