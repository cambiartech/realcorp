"use client";

import { InvoicePrintView } from "@/components/finance/invoice-print-view";
import { PdfDownloadButton } from "@/components/pdf-download-button";
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
        <PdfDownloadButton filename={`invoice-${props.invoiceNumber}`}>Download PDF</PdfDownloadButton>
      </div>
      <InvoicePrintView {...props} />
    </>
  );
}
