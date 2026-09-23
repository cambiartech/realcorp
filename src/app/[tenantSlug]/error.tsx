"use client";

import { useEffect, useRef } from "react";

function errorReference(error: Error & { digest?: string }, fallback: string): string {
  const digest = typeof error.digest === "string" ? error.digest.replace(/\s+/g, "") : "";
  return digest || fallback;
}

/**
 * Recoverable error boundary for tenant pages. Keeps the app shell (sidebar,
 * header) alive — unlike global-error.tsx which replaces the whole document.
 */
export default function TenantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const fallbackRef = useRef("");
  if (!fallbackRef.current) {
    fallbackRef.current = `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }
  const reference = errorReference(error, fallbackRef.current);

  useEffect(() => {
    console.error("[tenant-error]", error);
    if (typeof window === "undefined") return;

    void fetch("/api/platform/error-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        digest: reference,
        name: error.name || null,
        message: error.message || null,
        stack: typeof error.stack === "string" ? error.stack : null,
        pathname: window.location.pathname,
        requestUrl: window.location.href,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        metadata: { source: "tenant-error-boundary" },
      }),
      keepalive: true,
    }).catch(() => {
      // best-effort telemetry only
    });
  }, [error, reference]);

  return (
    <div className="flex w-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">Something went wrong on this page</h1>
        <p className="mt-2 text-sm text-muted">
          The rest of the app is fine — try again, or head back to your dashboard.
        </p>
        <p className="mt-4 text-xs text-muted">
          Quote this reference if you send a screenshot.
        </p>
        <p className="mt-1 text-sm font-semibold tracking-wide text-foreground">
          Error reference{" "}
          <code className="rounded-md border border-foreground/20 bg-field px-2 py-1 font-mono text-base">
            {reference}
          </code>
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              const tenantSlug = window.location.pathname.split("/")[1];
              window.location.href = tenantSlug ? `/${tenantSlug}` : "/";
            }}
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/[0.06]"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
