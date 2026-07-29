import { HrFormPrintDocument } from "@/components/hr/hr-form-print-document";
import { HrPrintToolbar } from "@/components/hr/hr-print-toolbar";
import { brandingCssVars } from "@/lib/tenant-branding";
import { loadHrFormRequestByToken } from "@/lib/hr-form-request-loader";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HrFormPrintPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const loaded = await loadHrFormRequestByToken(token);
  if (!loaded) notFound();

  return (
    <div
      className="min-h-screen bg-white py-8 px-4 print:py-0 print:px-0"
      style={brandingCssVars(loaded.brand)}
    >
      <HrPrintToolbar />
      <HrFormPrintDocument
        brand={loaded.brand}
        formType={loaded.formType}
        employeeName={loaded.profile?.fullName || loaded.recipientName || undefined}
      />
    </div>
  );
}
