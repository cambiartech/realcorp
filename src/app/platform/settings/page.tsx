import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { parsePayrollDisbursementSettings } from "@/lib/payroll/disbursement";
import { normalizeTenantModuleFlags, tenantModuleSummary } from "@/lib/tenant-module-definitions";
import { PlatformModulesForm } from "../modules-form";
import { PlatformFeeSettings, type PlatformFeeSettingRow } from "./platform-fee-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings · Platform",
};

const SETTINGS_TABS = [
  { id: "fees", label: "Payroll fees" },
  { id: "funding", label: "Funding accounts" },
  { id: "modules", label: "Modules" },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

export default async function PlatformSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) {
    redirect("/login?callbackUrl=/platform/settings");
  }

  const { tab } = await searchParams;
  const active: SettingsTab = tab === "funding" || tab === "modules" ? tab : "fees";

  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      settings: true,
    },
  });

  const rows: PlatformFeeSettingRow[] = tenants.map((tenant) => {
    const settings = parsePayrollDisbursementSettings(tenant.settings?.payrollDisbursementSettings);
    const provider =
      settings.dvaProvider === "FLUTTERWAVE" ? "FLUTTERWAVE" : settings.dvaProvider === "PAYSTACK" ? "PAYSTACK" : "";
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

  const intro =
    active === "funding"
      ? "The dedicated account each organization pays into. Open a row to edit the bank details."
      : active === "modules"
        ? "Turn modules on or off for each organization."
        : "Per person is charged on every salary. Base fee is charged once per payroll. Paystack’s transfer fee is added on top. Saving one row does not change the others.";

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      <p className="mt-1 text-sm text-muted">{intro}</p>

      <div className="mt-6 flex flex-wrap gap-1 border-b border-foreground/10 pb-1" role="tablist" aria-label="Settings">
        {SETTINGS_TABS.map((item) => {
          const on = item.id === active;
          return (
            <Link
              key={item.id}
              href={`/platform/settings?tab=${item.id}`}
              role="tab"
              aria-selected={on}
              className={[
                "rounded-md px-3 py-2 text-sm font-medium",
                on ? "bg-foreground text-background" : "text-muted hover:bg-foreground/[0.06] hover:text-foreground",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-6">
        {active === "fees" ? <PlatformFeeSettings rows={rows} /> : null}
        {active === "funding" ? (
          <div className="overflow-x-auto rounded-lg border border-foreground/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Bank</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.tenantSlug} className="border-b border-foreground/5 last:border-b-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{row.tenantName}</p>
                      <p className="font-mono text-xs text-muted">/{row.tenantSlug}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{row.dvaAccountNumber || "—"}</td>
                    <td className="px-4 py-3 text-muted">{row.dvaBankName || "—"}</td>
                    <td className="px-4 py-3 text-muted">{row.dvaAccountName || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/platform/tenants/${row.tenantSlug}?tab=settings&section=funding`}
                        className="text-xs font-semibold text-foreground underline underline-offset-2"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {active === "modules" ? (
          <div className="overflow-x-auto rounded-lg border border-foreground/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Modules</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-foreground/5 last:border-b-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{tenant.name}</p>
                      <p className="font-mono text-xs text-muted">/{tenant.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <PlatformModulesForm
                        tenantId={tenant.id}
                        tenantName={tenant.name}
                        tenantSlug={tenant.slug}
                        summary={tenantModuleSummary(tenant.settings)}
                        initial={normalizeTenantModuleFlags(tenant.settings)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
