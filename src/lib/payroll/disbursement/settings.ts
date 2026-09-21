import { z } from "zod";

/** TenantSettings.payrollDisbursementSettings shape (Phase 0–1). */
export type PayrollDisbursementSettings = {
  feeFlatNaira: number;
  feePercentBps: number;
  feeCapNaira?: number;
  activeProvider?: "PAYSTACK" | "FLUTTERWAVE" | null;
  fundingAccountLabel?: string;
  fundingBankName?: string;
  fundingAccountNumber?: string;
  fundingAccountName?: string;
};

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

  return {
    feeFlatNaira,
    feePercentBps,
    feeCapNaira,
    activeProvider: provider,
    fundingAccountLabel: typeof obj.fundingAccountLabel === "string" ? obj.fundingAccountLabel : "",
    fundingBankName: typeof obj.fundingBankName === "string" ? obj.fundingBankName : "",
    fundingAccountNumber: typeof obj.fundingAccountNumber === "string" ? obj.fundingAccountNumber : "",
    fundingAccountName: typeof obj.fundingAccountName === "string" ? obj.fundingAccountName : "",
  };
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
});
