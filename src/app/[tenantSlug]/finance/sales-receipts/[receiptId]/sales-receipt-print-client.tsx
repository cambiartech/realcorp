"use client";

import { SalesReceiptPrintView } from "@/components/finance/sales-receipt-print-view";
import { PdfDownloadButton } from "@/components/pdf-download-button";
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
        <PdfDownloadButton filename={`sales-receipt-${props.receiptNumber}`}>Download PDF</PdfDownloadButton>
      </div>
      <SalesReceiptPrintView {...props} />
    </>
  );
}
