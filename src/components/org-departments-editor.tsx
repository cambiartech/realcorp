"use client";

import { useState } from "react";
import { DEFAULT_ORG_DEPARTMENTS, normalizeOrgDepartmentName } from "@/lib/org-departments";

type Props = {
  customDepartments: string[];
  onCustomDepartmentsChange: (next: string[]) => void;
};

export function OrgDepartmentsEditor({ customDepartments, onCustomDepartmentsChange }: Props) {
  const [newDepartment, setNewDepartment] = useState("");

  function addDepartment() {
    const next = normalizeOrgDepartmentName(newDepartment);
    if (!next) return;
    if (DEFAULT_ORG_DEPARTMENTS.includes(next as (typeof DEFAULT_ORG_DEPARTMENTS)[number])) {
      setNewDepartment("");
      return;
    }
    if (customDepartments.some((d) => d.toLowerCase() === next.toLowerCase())) {
      setNewDepartment("");
      return;
    }
    onCustomDepartmentsChange([...customDepartments, next]);
    setNewDepartment("");
  }

  return (
    <div id="org-departments" className="scroll-mt-6">
      <h3 className="text-sm font-semibold text-foreground">Departments</h3>
      <p className="mt-1 text-xs text-muted">
        One shared list for Finance, HR, reporting, and anywhere you tag work by department. Defaults match
        your enabled modules; add custom names for Operations, Legal, and so on.
      </p>

      <input type="hidden" name="orgDepartmentsCsv" value={customDepartments.join("\n")} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {DEFAULT_ORG_DEPARTMENTS.map((department) => (
          <span
            key={department}
            className="inline-flex rounded-full border border-foreground/20 bg-foreground/[0.03] px-2.5 py-1 text-[11px] font-medium text-foreground"
          >
            {department} (default)
          </span>
        ))}
      </div>

      <div className="mt-3 flex max-w-lg items-center gap-2">
        <input
          value={newDepartment}
          onChange={(e) => setNewDepartment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDepartment();
            }
          }}
          placeholder="Add custom department"
          className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
        />
        <button
          type="button"
          onClick={addDepartment}
          className="shrink-0 rounded-md border border-foreground/20 px-3 py-2 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
        >
          Add
        </button>
      </div>

      <div className="mt-2 flex max-w-lg flex-wrap gap-2">
        {customDepartments.length === 0 ? (
          <span className="text-[11px] text-muted">No custom departments yet.</span>
        ) : (
          customDepartments.map((department) => (
            <span
              key={department}
              className="inline-flex items-center gap-1 rounded-full border border-foreground/20 px-2.5 py-1 text-[11px] font-medium text-foreground"
            >
              {department}
              <button
                type="button"
                aria-label={`Remove ${department}`}
                onClick={() => onCustomDepartmentsChange(customDepartments.filter((x) => x !== department))}
                className="rounded px-1 text-muted hover:bg-foreground/[0.08] hover:text-foreground"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted">Default departments cannot be removed.</p>
    </div>
  );
}
