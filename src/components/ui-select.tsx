"use client";

import type { SelectHTMLAttributes } from "react";

type UiSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export function UiSelect({ className = "", invalid, children, ...props }: UiSelectProps) {
  const base = [
    "w-full appearance-none border bg-field px-3 py-2 pr-9 text-foreground focus:outline-none focus:ring-2",
    invalid
      ? "border-error ring-2 ring-error/20 focus:ring-error/25"
      : "border-foreground/15 focus:ring-foreground/20 dark:border-foreground/20",
    className,
  ]
    .join(" ")
    .trim();

  return (
    <div className="relative">
      <select {...props} className={base}>
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M5 7.5l5 5 5-5" />
        </svg>
      </span>
    </div>
  );
}
