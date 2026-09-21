"use client";

import { UiSelect } from "@/components/ui-select";
import { HrFormField, HrFormSelect } from "@/components/hr/hr-form-field";
import { pensionAdministratorSelectOptions } from "@/lib/org-pension-administrators";
import { STATUTORY_NIL } from "@/lib/hr-statutory";

const APP_INPUT =
  "w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30";

export function PensionAdministratorField({
  name = "pensionAdministrator",
  defaultValue = "",
  options,
  variant = "app",
  emptyHint,
}: {
  name?: string;
  defaultValue?: string;
  options: string[];
  variant?: "app" | "public";
  emptyHint?: string;
}) {
  const list = pensionAdministratorSelectOptions(options, defaultValue).filter(
    (item) => item.toUpperCase() !== STATUTORY_NIL,
  );

  if (list.length === 0) {
    if (variant === "public") {
      return (
        <HrFormField
          label="Pension administrator (PFA)"
          name={name}
          defaultValue={defaultValue}
          placeholder="e.g. Stanbic IBTC Pension Managers Limited — or NIL"
        />
      );
    }
    return (
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-foreground">Pension administrator (PFA)</span>
        <input name={name} defaultValue={defaultValue} className={APP_INPUT} placeholder="Name or NIL" />
        <span className="mt-0.5 block text-[11px] text-muted">
          {emptyHint || "Optional. Use NIL if the employee is not interested in pension."}
        </span>
      </label>
    );
  }

  if (variant === "public") {
    return (
      <HrFormSelect
        label="Pension administrator (PFA)"
        name={name}
        defaultValue={defaultValue}
        options={[
          { value: "", label: "Select PFA (optional)" },
          { value: STATUTORY_NIL, label: "NIL — not applicable" },
          ...list.map((item) => ({ value: item, label: item })),
        ]}
      />
    );
  }

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-foreground">Pension administrator (PFA)</span>
      <UiSelect name={name} defaultValue={defaultValue}>
        <option value="">Select PFA (optional)</option>
        <option value={STATUTORY_NIL}>NIL — not applicable</option>
        {list.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </UiSelect>
      <span className="mt-0.5 block text-[11px] text-muted">
        {emptyHint || "Optional. NIL does not block onboarding or payroll."}
      </span>
    </label>
  );
}
