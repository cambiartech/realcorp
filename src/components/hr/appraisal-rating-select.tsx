"use client";

import { APPRAISAL_RATING_OPTIONS } from "@/lib/appraisal-competencies";
import { UiSelect } from "@/components/ui-select";

type AppraisalRatingSelectProps = {
  name: string;
  defaultValue?: number | null;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function AppraisalRatingSelect({
  name,
  defaultValue,
  disabled,
  placeholder = "Select score (0–5)",
  className,
}: AppraisalRatingSelectProps) {
  return (
    <UiSelect
      name={name}
      defaultValue={defaultValue != null ? String(defaultValue) : ""}
      disabled={disabled}
      className={className}
    >
      <option value="">{placeholder}</option>
      {APPRAISAL_RATING_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </UiSelect>
  );
}
