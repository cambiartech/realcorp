import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { parsePayrollDisbursementSettings } from "@/lib/payroll/disbursement";
import { PlatformFeeSettings, type PlatformFeeSettingRow } from "./platform-fee-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings · Platform",
};

export default async function PlatformSettingsPage() {
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) {
    redirect("/login?callbackUrl=/platform/settings");
  }

  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    select: {
      name: true,
      slug: true,
      settings: { select: { payrollDisbursementSettings: true } },
    },
  });

  const rows: PlatformFeeSettingRow[] = tenants.map((tenant) => {
    const settings = parsePayrollDisbursementSettings(tenant.settings?.payrollDisbursementSettings);
    const provider = settings.dvaProvider === "FLUTTERWAVE" ? "FLUTTERWAVE" : settings.dvaProvider === "PAYSTACK" ? "PAYSTACK" : "";
    return {
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      feeFlatNaira: settings.feeFlatNaira,
      feeBaseNaira: settings.feeBaseNaira,
      feePercentBps: settings.feePercentBps,
      feeCapNaira: settings.feeCapNaira ?? "",
      requirePlatformApproval: Boolean(settings.requirePlatformApproval),
      fundingBankName: settings.fundingBankName || "",
      fundingAccountNumber: settings.fundingAccountNumber || "",
      fundingAccountName: settings.fundingAccountName || "",
      fundingAccountLabel: settings.fundingAccountLabel || "",
      dvaProvider: provider,
      dvaAccountNumber: settings.dvaAccountNumber || "",
      dvaBankName: settings.dvaBankName || "",
      dvaAccountName: settings.dvaAccountName || "",
      dvaBankCode: settings.dvaBankCode || "",
      dvaProviderAccountId: settings.dvaProviderAccountId || "",
      dvaCustomerCode: settings.dvaCustomerCode || "",
      dvaPurpose: settings.dvaPurpose || "PAYROLL_FLOAT",
      dvaNotes: settings.dvaNotes || "",
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Set each organization’s payroll fee here. Per person is charged on every salary. Base fee is charged once per
        payroll. Paystack’s own transfer fee is added on top and shown to HR before they pay. Saving one row does not
        change the others.
      </p>
      <div className="mt-6">
        <PlatformFeeSettings rows={rows} />
      </div>
    </div>
  );
}
