"use client";

import { useCallback, useState } from "react";
import { nextSortState, type SortDir } from "@/lib/table-sort";

export function useTableSort(defaultKey: string | null = null, defaultDir: SortDir = "asc") {
  const [sortKey, setSortKey] = useState<string | null>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const onSort = useCallback(
    (clickedKey: string) => {
      const next = nextSortState(sortKey, sortDir, clickedKey);
      setSortKey(next.key);
      setSortDir(next.dir);
    },
    [sortDir, sortKey],
  );

  return { sortKey, sortDir, onSort };
}

export function SortTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "left",
  className = "px-4 py-3",
}: {
  label: string;
  sortKey: string;
  activeKey: string | null;
  dir: SortDir;
  onSort: (key: string) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th className={className} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={[
          "inline-flex items-center gap-1 font-inherit text-inherit uppercase tracking-inherit hover:text-foreground",
          align === "right" ? "w-full justify-end" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {label}
        <span className={active ? "text-foreground" : "text-muted/50"} aria-hidden>
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}
