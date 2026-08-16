"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { DEFAULT_ORG_DEPARTMENTS, normalizeOrgDepartmentName } from "@/lib/org-departments";

type Props = {
  customDepartments: string[];
  onCustomDepartmentsChange: (next: string[]) => void;
};

export function OrgDepartmentsEditor({ customDepartments, onCustomDepartmentsChange }: Props) {
  const [newDepartment, setNewDepartment] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editError, setEditError] = useState("");

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

  function startEdit(department: string) {
    setEditing(department);
    setDraft(department);
    setEditError("");
  }

  function cancelEdit() {
    setEditing(null);
    setDraft("");
    setEditError("");
  }

  function commitEdit() {
    if (!editing) return;
    const next = normalizeOrgDepartmentName(draft);
    if (!next) {
      setEditError("Enter a department name.");
      return;
    }
    if (DEFAULT_ORG_DEPARTMENTS.some((d) => d.toLowerCase() === next.toLowerCase())) {
      setEditError("That name is already a default department.");
      return;
    }
    if (customDepartments.some((d) => d !== editing && d.toLowerCase() === next.toLowerCase())) {
      setEditError("A department with that name already exists.");
      return;
    }
    onCustomDepartmentsChange(customDepartments.map((d) => (d === editing ? next : d)));
    cancelEdit();
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
          customDepartments.map((department) =>
            editing === department ? (
              <span
                key={department}
                className="inline-flex items-center gap-1 rounded-full border border-foreground/30 bg-background px-2 py-1"
              >
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setEditError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitEdit();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEdit();
                    }
                  }}
                  className="w-40 rounded border border-foreground/15 bg-field px-2 py-0.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
                  aria-label={`Rename ${department}`}
                />
                <button
                  type="button"
                  onClick={commitEdit}
                  className="rounded px-1.5 text-[10px] font-semibold text-foreground hover:bg-foreground/[0.08]"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded px-1 text-[10px] text-muted hover:bg-foreground/[0.08] hover:text-foreground"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <span
                key={department}
                className="inline-flex items-center gap-1 rounded-full border border-foreground/20 px-2.5 py-1 text-[11px] font-medium text-foreground"
              >
                {department}
                <button
                  type="button"
                  aria-label={`Rename ${department}`}
                  title="Rename"
                  onClick={() => startEdit(department)}
                  className="rounded p-0.5 text-muted hover:bg-foreground/[0.08] hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${department}`}
                  title="Remove"
                  onClick={() => onCustomDepartmentsChange(customDepartments.filter((x) => x !== department))}
                  className="rounded p-0.5 text-muted hover:bg-foreground/[0.08] hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ),
          )
        )}
      </div>
      {editError ? <p className="mt-1 text-[11px] text-[var(--danger)]">{editError}</p> : null}
      <p className="mt-1 text-[11px] text-muted">
        Use the pencil to rename a custom department, then click Save departments. Default departments cannot
        be removed or renamed.
      </p>
    </div>
  );
}
