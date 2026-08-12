import Link from "next/link";
import { buildPageUrl, type SearchParamsInput } from "@/lib/pagination";

type PaginationControlProps = {
  pathname: string;
  searchParams: SearchParamsInput;
  pageParam: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  itemLabel?: string;
};

function pageItems(page: number, totalPages: number): Array<number | "ellipsis"> {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const validPages = Array.from(pages)
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b);

  const items: Array<number | "ellipsis"> = [];
  for (const current of validPages) {
    const previous = items.at(-1);
    if (typeof previous === "number" && current - previous > 1) items.push("ellipsis");
    items.push(current);
  }
  return items;
}

export function PaginationControl({
  pathname,
  searchParams,
  pageParam,
  page,
  pageSize,
  total,
  totalPages,
  itemLabel = "items",
}: PaginationControlProps) {
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);
  const linkClass =
    "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-foreground/15 px-2.5 text-sm font-medium text-foreground hover:bg-foreground/[0.06]";
  const disabledClass =
    "inline-flex min-h-9 min-w-9 cursor-not-allowed items-center justify-center rounded-md border border-foreground/10 px-2.5 text-sm font-medium text-muted/60";

  return (
    <nav
      aria-label={`${itemLabel} pagination`}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 px-4 py-3"
    >
      <p className="text-xs text-muted" aria-live="polite">
        Showing {firstItem}–{lastItem} of {total} {itemLabel}
      </p>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link
            href={buildPageUrl(pathname, searchParams, pageParam, page - 1)}
            className={linkClass}
            aria-label={`Previous ${itemLabel} page`}
          >
            Previous
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            Previous
          </span>
        )}

        {pageItems(page, totalPages).map((item, index) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted" aria-hidden="true">
              …
            </span>
          ) : item === page ? (
            <span
              key={item}
              aria-current="page"
              aria-label={`Page ${item}`}
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-foreground bg-foreground px-2.5 text-sm font-semibold text-background"
            >
              {item}
            </span>
          ) : (
            <Link
              key={item}
              href={buildPageUrl(pathname, searchParams, pageParam, item)}
              className={linkClass}
              aria-label={`Page ${item}`}
            >
              {item}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link
            href={buildPageUrl(pathname, searchParams, pageParam, page + 1)}
            className={linkClass}
            aria-label={`Next ${itemLabel} page`}
          >
            Next
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}
