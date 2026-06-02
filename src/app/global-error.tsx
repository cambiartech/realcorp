"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
    const digest = typeof error.digest === "string" ? error.digest : null;
    if (!digest || typeof window === "undefined") return;

    const payload = JSON.stringify({
      digest,
      name: error.name || null,
      message: error.message || null,
      stack: typeof error.stack === "string" ? error.stack : null,
      pathname: window.location.pathname,
      requestUrl: window.location.href,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      metadata: { source: "global-error-boundary" },
    });

    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/platform/error-reports", blob);
        return;
      }
      void fetch("/api/platform/error-reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      });
    } catch {
      // best-effort telemetry only
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
        <div className="w-full max-w-md rounded-xl border border-foreground/10 bg-background p-5 shadow-sm">
          <h1 className="text-lg font-semibold">This page could not load</h1>
          <p className="mt-2 text-sm text-muted">A server error occurred. Reload and try again.</p>
          {error.digest ? (
            <p className="mt-2 text-xs text-muted">
              Error reference:{" "}
              <code className="rounded border border-foreground/15 bg-field px-1.5 py-0.5 font-mono">
                {error.digest}
              </code>
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-md border border-foreground bg-foreground px-3 py-2 text-sm font-semibold text-background"
            >
              Reload
            </button>
            <a
              href="/"
              className="rounded-md border border-foreground/20 px-3 py-2 text-sm font-semibold text-foreground"
            >
              Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
