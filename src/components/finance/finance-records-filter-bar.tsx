"use client";

import { SearchableSelect } from "@/components/searchable-select";
import { UiSelect } from "@/components/ui-select";
import {
  EMPTY_FINANCE_RECORDS_FILTER,
  financeRecordsFilterIsActive,
  type FinanceRecordsFilterState,
} from "@/lib/finance-records-filter";
import { Search } from "lucide-react";

const inputClass =
  "w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20";

type ProjectOption = {
  id: string;
  label: string;
  units: Array<{ id: string; label: string }>;
};

export function FinanceRecordsFilterBar({
  value,
  onChange,
  projects,
  departments = [],
  categories = [],
  methods = [],
  statuses = [],
  showDepartment = true,
  showCategory = false,
  showMethod = false,
  showStatus = false,
  showUnit = true,
  resultCount,
  totalCount,
}: {
  value: FinanceRecordsFilterState;
  onChange: (next: FinanceRecordsFilterState) => void;
  projects: ProjectOption[];
  departments?: string[];
  categories?: string[];
  methods?: string[];
  statuses?: Array<{ value: string; label: string }>;
  showDepartment?: boolean;
  showCategory?: boolean;
  showMethod?: boolean;
  showStatus?: boolean;
  showUnit?: boolean;
  resultCount?: number;
  totalCount?: number;
}) {
  const selectedProject = projects.find((p) => p.id === value.projectId);
  const unitOptions =
    value.projectId !== "all" && selectedProject
      ? selectedProject.units
      : projects.flatMap((p) =>
          p.units.map((u) => ({
            id: u.id,
            label: `${p.label} · ${u.label}`,
          })),
        );
  const active = financeRecordsFilterIsActive(value);

  function patch(partial: Partial<FinanceRecordsFilterState>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="mb-4 rounded-xl border border-foreground/10 bg-foreground/[0.015] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Search & filter</p>
          <p className="text-xs text-muted">
            Search text, project, amount range, and dates. Use amount max for
            “≤ this amount”.
            {typeof resultCount === "number" && typeof totalCount === "number"
              ? ` Showing ${resultCount} of ${totalCount}.`
              : null}
          </p>
        </div>
        {active ? (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_FINANCE_RECORDS_FILTER })}
            className="text-xs font-semibold text-foreground underline decoration-foreground/25 underline-offset-2"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="mb-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={value.q}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder="Search vendor, client, reference, category, note…"
            className={`${inputClass} pl-9`}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <label className="space-y-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Project
          </span>
          <SearchableSelect
            value={value.projectId}
            onChange={(next) => patch({ projectId: next, unitId: "all" })}
            searchPlaceholder="Search projects…"
            options={[
              { value: "all", label: "All projects" },
              ...projects.map((p) => ({ value: p.id, label: p.label })),
            ]}
          />
        </label>

        {showUnit ? (
          <label className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Apartment / unit
            </span>
            <SearchableSelect
              value={value.unitId}
              onChange={(next) => {
                if (next === "all") {
                  patch({ unitId: "all" });
                  return;
                }
                const owner = projects.find((p) =>
                  p.units.some((u) => u.id === next),
                );
                patch({
                  unitId: next,
                  ...(owner ? { projectId: owner.id } : {}),
                });
              }}
              searchPlaceholder="Search units…"
              groups={[
                {
                  label: "",
                  options: [
                    { value: "all", label: "All apartments / units" },
                    ...unitOptions.map((u) => ({
                      value: u.id,
                      label: u.label,
                    })),
                  ],
                },
              ]}
            />
          </label>
        ) : null}

        {showDepartment ? (
          <label className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Department
            </span>
            <UiSelect
              value={value.department}
              onChange={(e) => patch({ department: e.target.value })}
            >
              <option value="all">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </UiSelect>
          </label>
        ) : null}

        {showCategory ? (
          <label className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Category
            </span>
            <UiSelect
              value={value.category}
              onChange={(e) => patch({ category: e.target.value })}
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </UiSelect>
          </label>
        ) : null}

        {showMethod ? (
          <label className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Method
            </span>
            <UiSelect
              value={value.method}
              onChange={(e) => patch({ method: e.target.value })}
            >
              <option value="all">All methods</option>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </UiSelect>
          </label>
        ) : null}

        {showStatus ? (
          <label className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Status
            </span>
            <UiSelect
              value={value.status}
              onChange={(e) => patch({ status: e.target.value })}
            >
              <option value="all">All statuses</option>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </UiSelect>
          </label>
        ) : null}

        <label className="space-y-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Amount min (≥)
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={value.amountMin}
            onChange={(e) => patch({ amountMin: e.target.value })}
            placeholder="e.g. 10000"
            className={inputClass}
          />
        </label>

        <label className="space-y-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Amount max (≤)
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={value.amountMax}
            onChange={(e) => patch({ amountMax: e.target.value })}
            placeholder="e.g. 500000"
            className={inputClass}
          />
        </label>

        <label className="space-y-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Date from
          </span>
          <input
            type="date"
            value={value.dateFrom}
            onChange={(e) => patch({ dateFrom: e.target.value })}
            className={inputClass}
          />
        </label>

        <label className="space-y-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Date to
          </span>
          <input
            type="date"
            value={value.dateTo}
            onChange={(e) => patch({ dateTo: e.target.value })}
            className={inputClass}
          />
        </label>
      </div>
    </div>
  );
}
