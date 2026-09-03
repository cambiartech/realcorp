"use client";

import { CalendarMonthPicker } from "@/components/calendar-month-picker";
import { clampFinanceYear, type FinancePeriodPreset } from "@/lib/finance-period";

export type FinancePeriodPickerValue = {
  preset: FinancePeriodPreset;
  monthKey: string;
  year: number;
  fromKey: string;
  toKey: string;
};

type FinancePeriodPickerProps = {
  value: FinancePeriodPickerValue;
  onChange: (next: FinancePeriodPickerValue) => void;
  disabled?: boolean;
};

const PRESETS: Array<{ id: FinancePeriodPreset; label: string }> = [
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
  { id: "custom", label: "Custom range" },
];

export function FinancePeriodPicker({ value, onChange, disabled }: FinancePeriodPickerProps) {
  const thisYear = new Date().getFullYear();
  const minYear = thisYear - 5;
  const year = clampFinanceYear(value.year);
  const atMinYear = year <= minYear;
  const atMaxYear = year >= thisYear;

  function setPreset(preset: FinancePeriodPreset) {
    if (preset === value.preset) return;
    onChange({ ...value, preset });
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="inline-flex flex-wrap justify-end gap-1 rounded-md border border-foreground/10 bg-background p-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => setPreset(preset.id)}
            className={[
              "rounded px-2.5 py-1 text-xs font-semibold disabled:opacity-50",
              value.preset === preset.id
                ? "bg-foreground text-background"
                : "text-muted hover:text-foreground",
            ].join(" ")}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {value.preset === "month" ? (
        <CalendarMonthPicker
          id="finance-overview-month"
          value={value.monthKey}
          disabled={disabled}
          onChange={(monthKey) => onChange({ ...value, preset: "month", monthKey })}
        />
      ) : null}

      {value.preset === "year" ? (
        <div className="inline-flex items-center overflow-hidden rounded-md border border-foreground/15 bg-field">
          <button
            type="button"
            disabled={disabled || atMinYear}
            onClick={() => onChange({ ...value, preset: "year", year: year - 1 })}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-foreground hover:bg-foreground/[0.06] disabled:cursor-not-allowed disabled:text-muted"
            aria-label="Previous year"
          >
            ‹
          </button>
          <label className="sr-only" htmlFor="finance-overview-year">
            Year
          </label>
          <input
            id="finance-overview-year"
            type="number"
            min={minYear}
            max={thisYear}
            defaultValue={year}
            key={year}
            disabled={disabled}
            onBlur={(e) => {
              const nextYear = clampFinanceYear(Number(e.target.value) || thisYear);
              if (nextYear === year) return;
              onChange({ ...value, preset: "year", year: nextYear });
            }}
            className="h-9 w-20 border-0 bg-transparent px-1 text-center text-sm font-semibold text-foreground focus:outline-none focus:ring-0"
          />
          <button
            type="button"
            disabled={disabled || atMaxYear}
            onClick={() => onChange({ ...value, preset: "year", year: year + 1 })}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-foreground hover:bg-foreground/[0.06] disabled:cursor-not-allowed disabled:text-muted"
            aria-label="Next year"
          >
            ›
          </button>
        </div>
      ) : null}

      {value.preset === "custom" ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted">
            From
            <input
              type="date"
              value={value.fromKey}
              max={value.toKey}
              disabled={disabled}
              onChange={(e) => {
                if (!e.target.value) return;
                onChange({ ...value, preset: "custom", fromKey: e.target.value });
              }}
              className="h-9 rounded-md border border-foreground/15 bg-field px-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            To
            <input
              type="date"
              value={value.toKey}
              min={value.fromKey}
              disabled={disabled}
              onChange={(e) => {
                if (!e.target.value) return;
                onChange({ ...value, preset: "custom", toKey: e.target.value });
              }}
              className="h-9 rounded-md border border-foreground/15 bg-field px-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
