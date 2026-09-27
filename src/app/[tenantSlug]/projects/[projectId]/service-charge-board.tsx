"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSnackbar } from "@/components/snackbar";
import { TableSearch, filterTableRows } from "@/components/table-search";
import { ButtonSpinner } from "@/components/button-spinner";
import { updateUnitServiceFee } from "../actions";

type BoardUnit = {
  id: string;
  label: string;
  unitType: string;
  serviceFee: number | null;
  resolvedServiceFee: number;
};

function money(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ServiceChargeBoard({
  tenantSlug,
  projectId,
  currency,
  projectCharge,
  units,
  canManage,
}: {
  tenantSlug: string;
  projectId: string;
  currency: string;
  projectCharge: number | null;
  units: BoardUnit[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const rows = useMemo(
    () => filterTableRows(units, query, (unit) => `${unit.label} ${unit.unitType}`),
    [units, query],
  );
  const zeroCount = units.filter((unit) => unit.resolvedServiceFee === 0).length;

  async function save(unit: BoardUnit) {
    const raw = (drafts[unit.id] ?? (unit.serviceFee != null ? String(unit.serviceFee) : "")).trim();
    const serviceFee = raw === "" ? null : Number(raw.replace(/,/g, ""));
    if (serviceFee != null && (!Number.isFinite(serviceFee) || serviceFee < 0)) {
      showSnackbar("Enter zero or an amount.", "error");
      return;
    }
    setSavingId(unit.id);
    const result = await updateUnitServiceFee(tenantSlug, projectId, unit.id, serviceFee);
    setSavingId(null);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar("Service charge saved.", "success");
    router.refresh();
  }

  return (
    <section className="mt-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-foreground">
            {units.length} listing{units.length === 1 ? "" : "s"}
            {zeroCount ? ` · ${zeroCount} at zero` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">
            {projectCharge != null
              ? `Project charge ${money(currency, projectCharge)}. A blank row uses that figure.`
              : "A blank row has no charge of its own."}
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <TableSearch
            value={query}
            onChange={setQuery}
            placeholder="Search listings…"
            resultCount={rows.length}
            totalCount={units.length}
          />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Listing</th>
              <th className="px-4 py-3">Layout</th>
              <th className="px-4 py-3">Service charge</th>
              <th className="px-4 py-3">Current</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-sm text-muted">
                  {units.length === 0 ? "No listings on this project yet." : "No listings match that search."}
                </td>
              </tr>
            ) : (
              rows.map((unit) => {
                const own = unit.serviceFee != null;
                const value = drafts[unit.id] ?? (own ? String(unit.serviceFee) : "");
                return (
                  <tr key={unit.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{unit.label}</td>
                    <td className="px-4 py-3 text-muted">{unit.unitType}</td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <div className="flex items-center gap-2">
                          <input
                            inputMode="decimal"
                            value={value}
                            placeholder={projectCharge != null ? String(projectCharge) : "0"}
                            onChange={(event) =>
                              setDrafts((current) => ({ ...current, [unit.id]: event.target.value }))
                            }
                            className="w-36 border border-foreground/15 bg-field px-3 py-2 text-sm tabular-nums text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                          />
                          <button
                            type="button"
                            disabled={savingId === unit.id}
                            onClick={() => void save(unit)}
                            className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50"
                          >
                            {savingId === unit.id ? <ButtonSpinner /> : null}
                            Save
                          </button>
                        </div>
                      ) : (
                        <span className="tabular-nums text-foreground">
                          {money(currency, unit.resolvedServiceFee)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {money(currency, unit.resolvedServiceFee)}
                      <span className="mt-0.5 block text-[11px] font-normal text-muted">
                        {own ? "This listing" : projectCharge != null ? "Project charge" : "None set"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
