"use client";

import { useEffect, useMemo, useState } from "react";

export const CLIENT_TABLE_PAGE_SIZE = 25;

export function useClientPage<T>(
  items: T[],
  options?: { pageSize?: number; resetKey?: string | number },
) {
  const pageSize = options?.pageSize ?? CLIENT_TABLE_PAGE_SIZE;
  const [page, setPage] = useState(1);
  const resetKey = options?.resetKey;

  useEffect(() => {
    setPage(1);
  }, [resetKey, items.length, pageSize]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const rows = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );

  return { page: safePage, setPage, rows, total, totalPages, pageSize };
}

export function ClientTablePager({
  page,
  setPage,
  total,
  pageSize,
  itemLabel,
}: {
  page: number;
  setPage: (page: number) => void;
  total: number;
  pageSize: number;
  itemLabel: string;
}) {
  if (total <= pageSize) return null;
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const btn =
    "rounded-md border border-foreground/15 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-foreground/[0.06] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav
      aria-label={`${itemLabel} pagination`}
      className="flex flex-wrap items-center justify-between gap-2 border-t border-foreground/10 px-3 py-2.5"
    >
      <p className="text-xs text-muted" aria-live="polite">
        Showing {first}–{last} of {total} {itemLabel}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={btn}
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span className="px-2 text-xs text-muted">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className={btn}
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
