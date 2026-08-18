"use client";

export function filterTableRows<T>(rows: T[], query: string, haystack: (row: T) => string) {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const parts = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    const text = haystack(row).toLowerCase();
    return parts.every((part) => text.includes(part));
  });
}

export function TableSearch({
  value,
  onChange,
  placeholder = "Search…",
  resultCount,
  totalCount,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  resultCount?: number;
  totalCount?: number;
  className?: string;
}) {
  return (
    <div className={["flex min-w-[220px] flex-1 flex-wrap items-center gap-2", className].filter(Boolean).join(" ")}>
      <label className="relative block min-w-[220px] max-w-sm flex-1">
        <span className="sr-only">{placeholder}</span>
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
        />
      </label>
      {value.trim() && totalCount != null ? (
        <p className="text-xs text-muted">
          {resultCount ?? 0} of {totalCount}
        </p>
      ) : null}
    </div>
  );
}
