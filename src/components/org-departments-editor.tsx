"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { syncCustomOrgDepartments } from "@/app/[tenantSlug]/settings/actions";
import { useSnackbar } from "@/components/snackbar";
import { DEFAULT_ORG_DEPARTMENTS, isDefaultOrgDepartment, normalizeOrgDepartmentName } from "@/lib/org-departments";

type Props = {
  tenantSlug?: string;
  customDepartments: string[];
  onCustomDepartmentsChange: (next: string[]) => void;
  compact?: boolean;
};

export function OrgDepartmentsEditor({
  tenantSlug,
  customDepartments,
  onCustomDepartmentsChange,
  compact = false,
}: Props) {
  const { showSnackbar } = useSnackbar();
  const [newDepartment, setNewDepartment] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);

  async function persist(next: string[], successMessage: string) {
    if (!tenantSlug) {
      onCustomDepartmentsChange(next);
      return true;
    }
    setSaving(true);
    const result = await syncCustomOrgDepartments(tenantSlug, next);
    setSaving(false);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return false;
    }
    onCustomDepartmentsChange(next);
    showSnackbar(successMessage, "success");
    return true;
  }

  async function addDepartment() {
    const next = normalizeOrgDepartmentName(newDepartment);
    if (!next) return;
    if (isDefaultOrgDepartment(next)) {
      setNewDepartment("");
      showSnackbar(`${next} is already a built-in department.`, "error");
      return;
    }
    if (customDepartments.some((d) => d.toLowerCase() === next.toLowerCase())) {
      setNewDepartment("");
      return;
    }
    const ok = await persist([...customDepartments, next], `${next} added. It now shows on invite and People.`);
    if (ok) setNewDepartment("");
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

  async function commitEdit() {
    if (!editing) return;
    const next = normalizeOrgDepartmentName(draft);
    if (!next) {
      setEditError("Enter a department name.");
      return;
    }
    if (isDefaultOrgDepartment(next)) {
      setEditError("That name is reserved for a built-in department.");
      return;
    }
    if (
      next.toLowerCase() !== editing.toLowerCase() &&
      customDepartments.some((d) => d.toLowerCase() === next.toLowerCase())
    ) {
      setEditError("That department already exists.");
      return;
    }
    const updated = customDepartments.map((d) => (d === editing ? next : d));
    const ok = await persist(updated, `Renamed to ${next}.`);
    if (ok) cancelEdit();
  }

  async function removeDepartment(department: string) {
    const ok = await persist(
      customDepartments.filter((d) => d !== department),
      `${department} removed.`,
    );
    if (ok && editing === department) cancelEdit();
  }

  return (
    <div className={compact ? "" : "rounded-lg border border-foreground/10 p-4"}>
      {!compact ? (
        <>
          <p className="text-sm font-semibold text-foreground">Departments</p>
          <p className="mt-1 text-xs text-muted">
            Org units for invites, People, Finance, and reporting — e.g. Finance, Sales, Operations.
            Do not add job titles here (Front Desk Officer belongs under Job titles / People record).
            Access roles stay on Team invites.
          </p>
        </>
      ) : (
        <p className="mb-3 text-xs text-muted">
          Teams only — not job titles. Front Desk / Receptionist go under Job titles on the employee
          record. Built-ins below cannot be deleted.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-foreground/10 bg-foreground/[0.03] text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Department</th>
              <th className="px-3 py-2.5 font-semibold">Type</th>
              <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {DEFAULT_ORG_DEPARTMENTS.map((department) => (
              <tr key={department} className="border-b border-foreground/[0.06]">
                <td className="px-3 py-2.5 font-medium text-foreground">{department}</td>
                <td className="px-3 py-2.5 text-xs text-muted">Built-in</td>
                <td className="px-3 py-2.5 text-right text-[11px] text-muted">Locked</td>
              </tr>
            ))}
            {customDepartments.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-xs text-muted">
                  No custom departments yet — add Operations, Facility, etc. below.
                </td>
              </tr>
            ) : (
              customDepartments.map((department) => (
                <tr key={department} className="border-b border-foreground/[0.06] last:border-0">
                  <td className="px-3 py-2.5">
                    {editing === department ? (
                      <div className="space-y-1">
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
                              void commitEdit();
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelEdit();
                            }
                          }}
                          className="w-full max-w-xs rounded-md border border-foreground/15 bg-field px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
                          aria-label={`Rename ${department}`}
                        />
                        {editError ? <p className="text-[11px] text-[var(--danger)]">{editError}</p> : null}
                      </div>
                    ) : (
                      <span className="font-medium text-foreground">{department}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted">Custom</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {editing === department ? (
                        <>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void commitEdit()}
                            className="rounded px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-foreground/[0.06] disabled:opacity-40"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded px-2 py-1 text-[11px] text-muted hover:bg-foreground/[0.06]"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => startEdit(department)}
                            className="rounded p-1.5 text-muted hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-40"
                            aria-label={`Edit ${department}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void removeDepartment(department)}
                            className="rounded p-1.5 text-muted hover:bg-[var(--danger-wash)] hover:text-[var(--danger)] disabled:opacity-40"
                            aria-label={`Remove ${department}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex max-w-xl items-center gap-2">
        <input
          value={newDepartment}
          onChange={(e) => setNewDepartment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addDepartment();
            }
          }}
          placeholder="e.g. Operations, Facility — not Front Desk"
          disabled={saving}
          className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
        />
        <button
          type="button"
          onClick={() => void addDepartment()}
          disabled={saving}
          className="shrink-0 rounded-md border border-foreground/20 px-3 py-2 text-xs font-semibold text-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add"}
        </button>
      </div>
    </div>
  );
}
