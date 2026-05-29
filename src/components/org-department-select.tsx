"use client";

import { UiSelect } from "@/components/ui-select";

export function orgDepartmentsSettingsHref(tenantSlug: string): string {
  return `/${tenantSlug}/settings?tab=organization#org-departments`;
}

type Props = {
  departments: string[];
  value: string;
  onChange: (value: string) => void;
  name?: string;
  label?: string;
  required?: boolean;
};

export function OrgDepartmentSelect({
  departments,
  value,
  onChange,
  name = "department",
  label = "Department (optional)",
  required = false,
}: Props) {
  const sorted = [...departments].sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <label className="mb-1 block text-sm text-muted">{label}</label>
      <UiSelect name={name} value={value} required={required} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select department</option>
        {sorted.map((department) => (
          <option key={department} value={department}>
            {department}
          </option>
        ))}
      </UiSelect>
    </div>
  );
}
