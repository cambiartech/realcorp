import Link from "next/link";

export default function TenantNotFound() {
  return (
    <div className="flex w-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">404</p>
        <h1 className="mt-1 text-lg font-semibold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted">
          This page doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <div className="mt-5">
          <Link
            href="/"
            className="inline-flex rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
