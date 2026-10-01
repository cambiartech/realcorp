"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { platformSavePayrollDisbursementSettings } from "@/app/platform/actions";

export type PlatformFeeSettingRow = {
  tenantSlug: string;
  tenantName: string;
  feeFlatNaira: number;
  feeBaseNaira: number;
  feePercentBps: number;
  feeCapNaira: number | "";
  requirePlatformApproval: boolean;
  fundingBankName: string;
  fundingAccountNumber: string;
  fundingAccountName: string;
  fundingAccountLabel: string;
  dvaProvider: "PAYSTACK" | "FLUTTERWAVE" | "";
  dvaAccountNumber: string;
  dvaBankName: string;
  dvaAccountName: string;
  dvaBankCode: string;
  dvaProviderAccountId: string;
  dvaCustomerCode: string;
  dvaPurpose: string;
  dvaNotes: string;
};

function FeeRow({ row }: { row: PlatformFeeSettingRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [flat, setFlat] = useState(String(row.feeFlatNaira));
  const [base, setBase] = useState(String(row.feeBaseNaira));
  const [approval, setApproval] = useState(row.requirePlatformApproval ? "yes" : "no");

  return (
    <tr className="border-b border-foreground/5 last:border-b-0">
      <td className="px-4 py-3 align-top">
        <p className="font-medium text-foreground">{row.tenantName}</p>
        <p className="font-mono text-xs text-muted">/{row.tenantSlug}</p>
        {notice ? (
          <p className={`mt-1 text-xs ${notice.ok ? "text-foreground" : "text-[var(--danger)]"}`}>{notice.text}</p>
        ) : null}
      </td>
      <td className="px-4 py-3 align-top">
        <input
          type="number"
          min={0}
          step="0.01"
          value={flat}
          onChange={(event) => setFlat(event.target.value)}
          className="w-28 rounded-md border border-foreground/15 bg-background px-2 py-1.5 font-mono text-sm"
        />
      </td>
      <td className="px-4 py-3 align-top">
        <input
          type="number"
          min={0}
          step="0.01"
          value={base}
          onChange={(event) => setBase(event.target.value)}
          className="w-32 rounded-md border border-foreground/15 bg-background px-2 py-1.5 font-mono text-sm"
        />
      </td>
      <td className="px-4 py-3 align-top">
        <select
          value={approval}
          onChange={(event) => setApproval(event.target.value)}
          className="rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm"
        >
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </td>
      <td className="px-4 py-3 text-right align-top">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setNotice(null);
            startTransition(async () => {
              const result = await platformSavePayrollDisbursementSettings({
                tenantSlug: row.tenantSlug,
                feeFlatNaira: Number(flat || 0),
                feeBaseNaira: Number(base || 0),
                feePercentBps: row.feePercentBps,
                feeCapNaira: row.feeCapNaira === "" ? undefined : row.feeCapNaira,
                fundingBankName: row.fundingBankName,
                fundingAccountNumber: row.fundingAccountNumber,
                fundingAccountName: row.fundingAccountName,
                fundingAccountLabel: row.fundingAccountLabel,
                dvaProvider: row.dvaProvider,
                dvaAccountNumber: row.dvaAccountNumber,
                dvaBankName: row.dvaBankName,
                dvaAccountName: row.dvaAccountName,
                dvaBankCode: row.dvaBankCode,
                dvaProviderAccountId: row.dvaProviderAccountId,
                dvaCustomerCode: row.dvaCustomerCode,
                dvaPurpose: row.dvaPurpose,
                dvaNotes: row.dvaNotes,
                requirePlatformApproval: approval === "yes",
              });
              setNotice({
                ok: result.ok,
                text: result.ok ? "Saved." : result.error || "Could not save.",
              });
              if (result.ok) router.refresh();
            });
          }}
          className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </td>
    </tr>
  );
}

export function PlatformFeeSettings({ rows }: { rows: PlatformFeeSettingRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-foreground/10">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Organization</th>
            <th className="px-4 py-3 font-medium">Per person (₦)</th>
            <th className="px-4 py-3 font-medium">Base fee (₦)</th>
            <th className="px-4 py-3 font-medium">Wait for approval</th>
            <th className="px-4 py-3 font-medium"> </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-muted">
                No organizations yet.
              </td>
            </tr>
          ) : (
            rows.map((row) => <FeeRow key={row.tenantSlug} row={row} />)
          )}
        </tbody>
      </table>
    </div>
  );
}
