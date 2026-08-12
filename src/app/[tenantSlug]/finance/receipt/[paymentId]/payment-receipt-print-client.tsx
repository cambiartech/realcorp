"use client";

import { PaymentReceiptPrintView } from "@/components/finance/payment-receipt-print-view";
import { PdfDownloadButton } from "@/components/pdf-download-button";
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
        <PdfDownloadButton filename={`payment-receipt-${props.receiptNumber}`}>Download PDF</PdfDownloadButton>
      </div>
      <PaymentReceiptPrintView {...props} />
    </>
  );
}
