"use client";

import { useEffect, useMemo, useState } from "react";
import { addOrgJobRole } from "@/app/[tenantSlug]/settings/actions";
import { UiSelect } from "@/components/ui-select";
import { normalizeOrgJobRoleName } from "@/lib/org-job-roles";

const NEW_VALUE = "__new_job_role__";

type Props = {
  tenantSlug?: string;
  jobRoles: string[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  label?: string;
  hideLabel?: boolean;
  required?: boolean;
  allowCreate?: boolean;
};

function withCurrentRole(roles: string[], current: string) {
  const extra = current.trim();
  if (!extra) return roles;
  if (roles.some((item) => item.toLowerCase() === extra.toLowerCase())) return roles;
  return [...roles, extra];
}

export function OrgJobRoleSelect({
  tenantSlug,
  jobRoles,
  value,
  defaultValue = "",
  onChange,
  name = "position",
  label = "Job title",
  hideLabel = false,
  required = false,
  allowCreate = true,
}: Props) {
  const [localRoles, setLocalRoles] = useState(() => withCurrentRole(jobRoles, value ?? defaultValue));
  const [selected, setSelected] = useState(value ?? defaultValue);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalRoles((list) => {
      const next = [...list];
      for (const role of jobRoles) {
        if (!next.some((item) => item.toLowerCase() === role.toLowerCase())) next.push(role);
      }
      return withCurrentRole(next, value ?? defaultValue);
    });
  }, [jobRoles, value, defaultValue]);

  const sorted = useMemo(() => [...localRoles].sort((a, b) => a.localeCompare(b)), [localRoles]);
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
    const next = normalizeOrgJobRoleName(draft);
    if (!next) {
      setError("Enter a job title.");
      return;
    }
    const existing = localRoles.find((role) => role.toLowerCase() === next.toLowerCase());
    if (existing) {
      choose(existing);
      return;
    }
    setSaving(true);
    setError("");
    if (tenantSlug) {
      const result = await addOrgJobRole(tenantSlug, next);
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLocalRoles((list) => (list.includes(result.name) ? list : [...list, result.name]));
      choose(result.name);
      return;
    }
    setSaving(false);
    setLocalRoles((list) => [...list, next]);
    choose(next);
  }

  return (
    <div>
      {hideLabel ? null : (
        <label className="mb-1 block text-sm text-muted">{label}</label>
      )}
      <input type="hidden" name={name} value={current} />
      <UiSelect
        value={adding ? NEW_VALUE : current}
        required={required && !adding}
        onChange={(e) => choose(e.target.value)}
      >
        <option value="">Select job title</option>
        {sorted.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
        {allowCreate ? <option value={NEW_VALUE}>+ Add new job title…</option> : null}
      </UiSelect>
      {adding ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Digital Marketer"
            className="min-w-[12rem] flex-1 rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commitNew();
              }
            }}
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void commitNew()}
            className="rounded-md bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setDraft("");
              setError("");
            }}
            className="rounded-md border border-foreground/15 px-3 py-2 text-xs font-medium"
          >
            Cancel
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-xs text-[var(--danger)]">{error}</p> : null}
      <p className="mt-1 text-[11px] text-muted">Department is the team; job title is the specific role.</p>
    </div>
  );
}
