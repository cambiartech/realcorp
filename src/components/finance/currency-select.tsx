"use client";

import type { SelectHTMLAttributes } from "react";
import { UiSelect } from "@/components/ui-select";

type CurrencySelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  currencies: string[];
  /** Fallback when no finance currencies are configured */
  defaultCurrency?: string;
};

/** Dropdown of tenant finance currencies (from Finance Settings). */
export function CurrencySelect({
  currencies,
  defaultCurrency = "NGN",
  name = "currency",
  defaultValue,
  id,
  ...rest
}: CurrencySelectProps) {
  const options = currencies.length > 0 ? currencies : [defaultCurrency.trim().toUpperCase() || "NGN"];
  const resolvedDefault = String(defaultValue || options[0] || defaultCurrency)
    .trim()
    .toUpperCase();

  return (
    <UiSelect id={id} name={name} defaultValue={resolvedDefault} {...rest}>
      {options.map((currency) => (
        <option key={currency} value={currency}>
          {currency}
        </option>
      ))}
    </UiSelect>
  );
}
