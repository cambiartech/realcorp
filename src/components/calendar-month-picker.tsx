"use client";

import {
  compareMonthKeys,
  currentMonthKey,
  minMonthKey,
  monthLongLabel,
  resolveMonthKey,
  shiftMonthKey,
} from "@/lib/calendar-month";

type CalendarMonthPickerProps = {
  value: string;
  onChange: (next: string) => void;
  /** Inclusive max month key. Defaults to the current calendar month. */
  max?: string;
  /** How many months before `max` can be selected (including max). Default 24. */
  monthsBack?: number;
  disabled?: boolean;
  id?: string;
};

export function CalendarMonthPicker({
  value,
  onChange,
  max,
  monthsBack = 24,
  disabled,
  id,
}: CalendarMonthPickerProps) {
  const maxKey = resolveMonthKey(max);
  const minKey = minMonthKey(maxKey, monthsBack - 1);
  const selected = resolveMonthKey(value);
  const clamped =
    compareMonthKeys(selected, minKey) < 0
      ? minKey
      : compareMonthKeys(selected, maxKey) > 0
        ? maxKey
        : selected;
  const atMin = clamped === minKey;
  const atMax = clamped === maxKey;
  const isCurrent = clamped === maxKey;

  function go(delta: number) {
    if (disabled) return;
    const next = shiftMonthKey(clamped, delta);
    if (compareMonthKeys(next, minKey) < 0 || compareMonthKeys(next, maxKey) > 0) return;
    onChange(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="inline-flex items-center overflow-hidden rounded-md border border-foreground/15 bg-field">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={disabled || atMin}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-foreground hover:bg-foreground/[0.06] disabled:cursor-not-allowed disabled:text-muted"
          aria-label="Previous month"
        >
          ‹
        </button>
        <label className="sr-only" htmlFor={id || "calendar-month"}>
          Calendar month
        </label>
        <input
          id={id || "calendar-month"}
          type="month"
          value={clamped}
          min={minKey}
          max={maxKey}
          disabled={disabled}
          onChange={(e) => {
            const next = resolveMonthKey(e.target.value);
            if (compareMonthKeys(next, minKey) < 0 || compareMonthKeys(next, maxKey) > 0) return;
            onChange(next);
          }}
          className="h-9 w-[9.5rem] border-0 bg-transparent px-1 text-center text-sm font-semibold text-foreground focus:outline-none focus:ring-0"
          aria-label={monthLongLabel(clamped)}
        />
        <button
          type="button"
          onClick={() => go(1)}
          disabled={disabled || atMax}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-foreground hover:bg-foreground/[0.06] disabled:cursor-not-allowed disabled:text-muted"
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      {!isCurrent ? (
        <button
          type="button"
          onClick={() => onChange(maxKey)}
          disabled={disabled}
          className="h-9 rounded-md border border-foreground/15 px-2.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
        >
          This month
        </button>
      ) : null}
    </div>
  );
}

export function defaultCalendarMonth(): string {
  return currentMonthKey();
}
