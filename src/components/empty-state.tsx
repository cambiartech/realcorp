import Link from "next/link";

/**
 * Shared empty state for lists, tables, and panels.
 * Promoted from the Team workspace pattern so all modules look consistent.
 */
export function EmptyState({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  hint?: string;
  /** Optional call to action rendered as a button-style link. */
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-lg border border-dashed border-foreground/15 bg-foreground/[0.02] px-4 py-8 text-center text-sm",
        className ?? "",
      ].join(" ")}
    >
      <p className="font-medium text-foreground">{title}</p>
      {hint ? <p className="mx-auto mt-1 max-w-sm text-muted">{hint}</p> : null}
      {action ? (
        <Link
          href={action.href}
          className="mt-4 inline-flex rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
