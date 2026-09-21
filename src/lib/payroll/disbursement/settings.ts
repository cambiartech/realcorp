import { z } from "zod";

/** TenantSettings.payrollDisbursementSettings shape (Phase 0–1 + per-tenant DVA). */
export type PayrollDisbursementSettings = {
  feeFlatNaira: number;
  feePercentBps: number;
  feeCapNaira?: number;
  activeProvider?: "PAYSTACK" | "FLUTTERWAVE" | null;
  /** Legacy / generic funding instructions shown to the org. */
  fundingAccountLabel?: string;
  fundingBankName?: string;
  fundingAccountNumber?: string;
  fundingAccountName?: string;
  /**
   * Paystack Dedicated Virtual Account for this tenant (payroll float inbound).
   * Super Admin creates the DVA in Paystack (or later via API) then pastes details here.
   */
  dvaProvider?: "PAYSTACK" | "FLUTTERWAVE" | "";
  dvaAccountNumber?: string;
  dvaBankName?: string;
  dvaAccountName?: string;
  dvaBankCode?: string;
  /** Paystack dedicated_account id / customer code for webhook matching later. */
  dvaProviderAccountId?: string;
  dvaCustomerCode?: string;
  dvaPurpose?: string;
  dvaNotes?: string;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function parsePayrollDisbursementSettings(raw: unknown): PayrollDisbursementSettings {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const feeFlatNaira = typeof obj.feeFlatNaira === "number" && obj.feeFlatNaira >= 0 ? obj.feeFlatNaira : 0;
  const feePercentBps =
    typeof obj.feePercentBps === "number" && obj.feePercentBps >= 0 ? obj.feePercentBps : 0;
  const feeCapNaira =
    typeof obj.feeCapNaira === "number" && obj.feeCapNaira >= 0 ? obj.feeCapNaira : undefined;
  const provider =
    obj.activeProvider === "PAYSTACK" || obj.activeProvider === "FLUTTERWAVE"
      ? obj.activeProvider
      : null;
  const dvaProvider =
    obj.dvaProvider === "PAYSTACK" || obj.dvaProvider === "FLUTTERWAVE" ? obj.dvaProvider : "";

  return {
    feeFlatNaira,
    feePercentBps,
    feeCapNaira,
    activeProvider: provider,
    fundingAccountLabel: asString(obj.fundingAccountLabel),
    fundingBankName: asString(obj.fundingBankName),
    fundingAccountNumber: asString(obj.fundingAccountNumber),
    fundingAccountName: asString(obj.fundingAccountName),
    dvaProvider,
    dvaAccountNumber: asString(obj.dvaAccountNumber),
    dvaBankName: asString(obj.dvaBankName),
    dvaAccountName: asString(obj.dvaAccountName),
    dvaBankCode: asString(obj.dvaBankCode),
    dvaProviderAccountId: asString(obj.dvaProviderAccountId),
    dvaCustomerCode: asString(obj.dvaCustomerCode),
    dvaPurpose: asString(obj.dvaPurpose) || "PAYROLL_FLOAT",
    dvaNotes: asString(obj.dvaNotes),
  };
}

export function tenantHasDedicatedVirtualAccount(settings: PayrollDisbursementSettings): boolean {
  return Boolean(settings.dvaAccountNumber && settings.dvaBankName);
}

export const payrollDisbursementSettingsSchema = z.object({
  feeFlatNaira: z.number().min(0).max(1_000_000),
  feePercentBps: z.number().int().min(0).max(10_000),
  feeCapNaira: z.number().min(0).max(100_000_000).optional(),
  activeProvider: z.enum(["PAYSTACK", "FLUTTERWAVE"]).nullable().optional(),
  fundingAccountLabel: z.string().max(120).optional(),
  fundingBankName: z.string().max(120).optional(),
  fundingAccountNumber: z.string().max(32).optional(),
  fundingAccountName: z.string().max(120).optional(),
  dvaProvider: z.enum(["PAYSTACK", "FLUTTERWAVE", ""]).optional(),
  dvaAccountNumber: z.string().max(32).optional(),
  dvaBankName: z.string().max(120).optional(),
  dvaAccountName: z.string().max(160).optional(),
  dvaBankCode: z.string().max(12).optional(),
  dvaProviderAccountId: z.string().max(80).optional(),
  dvaCustomerCode: z.string().max(80).optional(),
  dvaPurpose: z.string().max(60).optional(),
  dvaNotes: z.string().max(500).optional(),
});
