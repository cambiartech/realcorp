"use client";

import { UiSelect } from "@/components/ui-select";
import { HrFormField, HrFormSelect } from "@/components/hr/hr-form-field";
import { pensionAdministratorSelectOptions } from "@/lib/org-pension-administrators";

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
  const list = pensionAdministratorSelectOptions(options, defaultValue);

  if (list.length === 0) {
    if (variant === "public") {
      return (
        <HrFormField
          label="Pension administrator (PFA)"
          name={name}
          defaultValue={defaultValue}
          placeholder="e.g. Stanbic IBTC Pension Managers Limited"
        />
      );
    }
    return (
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-foreground">Pension administrator (PFA)</span>
        <input name={name} defaultValue={defaultValue} className={APP_INPUT} />
        {emptyHint ? <span className="mt-0.5 block text-[11px] text-muted">{emptyHint}</span> : null}
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
          { value: "", label: "Select PFA" },
          ...list.map((item) => ({ value: item, label: item })),
        ]}
      />
    );
  }

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-foreground">Pension administrator (PFA)</span>
      <UiSelect name={name} defaultValue={defaultValue}>
        <option value="">Select PFA</option>
        {list.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </UiSelect>
      {emptyHint ? <span className="mt-0.5 block text-[11px] text-muted">{emptyHint}</span> : null}
    </label>
  );
}
