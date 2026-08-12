import { PdfDownloadButton } from "@/components/pdf-download-button";

export function HrPrintToolbar({ filename = "hr-form" }: { filename?: string }) {
  return (
    <div className="mb-6 flex justify-center print:hidden">
      <PdfDownloadButton
        filename={filename}
        className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-60"
        style={{ background: "var(--hr-brand-primary, #1e3a5f)" }}
      >
        Download PDF
      </PdfDownloadButton>
    </div>
  );
}
