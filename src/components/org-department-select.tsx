"use client";

import { useMemo, useState } from "react";
import { addOrgDepartment } from "@/app/[tenantSlug]/settings/actions";
import { UiSelect } from "@/components/ui-select";
import { normalizeOrgDepartmentName } from "@/lib/org-departments";

export function orgDepartmentsSettingsHref(tenantSlug: string): string {
  return `/${tenantSlug}/settings?tab=organization#org-departments`;
}

const NEW_VALUE = "__new_department__";

type Props = {
  tenantSlug?: string;
  departments: string[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  label?: string;
  hideLabel?: boolean;
  compact?: boolean;
  required?: boolean;
  allowCreate?: boolean;
};

function withCurrentDepartment(departments: string[], current: string) {
  const extra = current.trim();
  if (!extra) return departments;
  if (departments.some((item) => item.toLowerCase() === extra.toLowerCase())) return departments;
  return [...departments, extra];
}

export function OrgDepartmentSelect({
  tenantSlug,
  departments,
  value,
  defaultValue = "",
  onChange,
  name = "department",
  label = "Department (optional)",
  hideLabel = false,
  compact = false,
  required = false,
  allowCreate = true,
}: Props) {
  const [localDepartments, setLocalDepartments] = useState(() =>
    withCurrentDepartment(departments, value ?? defaultValue),
  );
  const [selected, setSelected] = useState(value ?? defaultValue);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(
    () => [...localDepartments].sort((a, b) => a.localeCompare(b)),
    [localDepartments],
  );
  const current = value ?? selected;

  function choose(next: string) {
    if (next === NEW_VALUE) {
      setAdding(true);
      setDraft("");
      setError("");
      return;
    }
    setAdding(false);
    setSelected(next);
    onChange?.(next);
  }

  async function commitNew() {
    const next = normalizeOrgDepartmentName(draft);
    if (!next) {
      setError("Enter a department name.");
      return;
    }
    const existing = localDepartments.find((d) => d.toLowerCase() === next.toLowerCase());
    if (existing) {
      choose(existing);
      return;
    }
    setSaving(true);
    setError("");
    if (tenantSlug) {
      const result = await addOrgDepartment(tenantSlug, next);
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLocalDepartments((list) => (list.includes(result.name) ? list : [...list, result.name]));
      choose(result.name);
      return;
    }
    setSaving(false);
    setLocalDepartments((list) => [...list, next]);
    choose(next);
  }

  return (
    <div>
      {hideLabel ? null : (
        <label className={compact ? "mb-1 block text-xs font-medium text-foreground" : "mb-1 block text-sm text-muted"}>
          {label}
        </label>
      )}
      <input type="hidden" name={name} value={current} />
      <UiSelect
        value={adding ? NEW_VALUE : current}
        required={required && !adding}
        onChange={(e) => choose(e.target.value)}
      >
        <option value="">Select department</option>
        {sorted.map((department) => (
          <option key={department} value={department}>
            {department}
          </option>
        ))}
        {allowCreate ? <option value={NEW_VALUE}>+ Add a department not on this list</option> : null}
      </UiSelect>
      {adding ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commitNew();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setAdding(false);
              }
            }}
            placeholder="e.g. Facilities"
            className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground"
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void commitNew()}
            className="shrink-0 rounded-md border border-foreground bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-[11px] text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
