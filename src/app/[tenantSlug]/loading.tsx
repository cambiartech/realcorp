/** Route-level loading skeleton shown while any tenant page's server data loads. */
export default function TenantLoading() {
  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8" aria-busy aria-label="Loading page">
      <div className="animate-pulse">
        {/* Page title */}
        <div className="h-7 w-48 rounded-md bg-foreground/[0.08]" />
        <div className="mt-2 h-4 w-72 rounded bg-foreground/[0.05]" />

        {/* Stat cards */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-foreground/10 p-4">
              <div className="h-3 w-20 rounded bg-foreground/[0.06]" />
              <div className="mt-3 h-6 w-16 rounded bg-foreground/[0.08]" />
            </div>
          ))}
        </div>

        {/* Content block */}
        <div className="mt-6 rounded-lg border border-foreground/10 p-4">
          <div className="h-4 w-32 rounded bg-foreground/[0.06]" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 rounded-md bg-foreground/[0.04]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
