"use client";

import { useMemo, useState } from "react";

export function TaskAssigneesField({
  options,
  defaultIds,
  onSelectionChange,
}: {
  options: Array<{ value: string; label: string }>;
  defaultIds: string[];
  onSelectionChange?: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState(defaultIds);
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, query]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      onSelectionChange?.(next);
      return next;
    });
  }

  return (
    <div>
      {selected.map((id) => (
        <input key={id} type="hidden" name="assigneeUserIds" value={id} />
      ))}
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search people…"
        className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground placeholder:text-muted"
      />
      <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-foreground/10">
        {visible.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted">No one matches.</p>
        ) : (
          visible.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-foreground/[0.04]"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggle(option.value)}
                className="h-3.5 w-3.5 accent-foreground"
              />
              <span className="min-w-0 truncate text-foreground">{option.label}</span>
            </label>
          ))
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted">
        {selected.length === 0 ? "Unassigned" : `${selected.length} selected`}
      </p>
    </div>
  );
}
