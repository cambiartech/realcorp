export default function FinanceOverviewLoading() {
  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8" aria-busy aria-label="Loading finance overview">
      <div className="animate-pulse">
        <div className="h-7 w-48 rounded-md bg-foreground/[0.08]" />
        <div className="mt-2 h-4 w-80 rounded bg-foreground/[0.05]" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-foreground/10 p-4">
              <div className="h-3 w-28 rounded bg-foreground/[0.06]" />
              <div className="mt-3 h-7 w-24 rounded bg-foreground/[0.08]" />
              <div className="mt-2 h-3 w-36 rounded bg-foreground/[0.04]" />
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-lg border border-foreground/10 p-4">
          <div className="h-4 w-32 rounded bg-foreground/[0.06]" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 rounded-md bg-foreground/[0.04]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
