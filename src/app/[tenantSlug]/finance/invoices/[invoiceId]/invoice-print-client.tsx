"use client";

import { Printer } from "lucide-react";
import { InvoicePrintView } from "@/components/finance/invoice-print-view";
import type { TenantBranding } from "@/lib/tenant-branding";

export function InvoicePrintClient(props: {
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
      <InvoicePrintView {...props} />
    </>
  );
}
