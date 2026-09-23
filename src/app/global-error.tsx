"use client";

import { useEffect, useRef } from "react";

function errorReference(error: Error & { digest?: string }, fallback: string): string {
  const digest = typeof error.digest === "string" ? error.digest.replace(/\s+/g, "") : "";
  return digest || fallback;
}

export default function GlobalError({
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
    console.error("[global-error]", error);
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
        metadata: { source: "global-error-boundary" },
      }),
      keepalive: true,
    }).catch(() => {
      // best-effort telemetry only
    });
  }, [error, reference]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
        <div className="w-full max-w-md rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5 shadow-sm">
          <h1 className="text-lg font-semibold">This page could not load</h1>
          <p className="mt-2 text-sm text-muted">A server error occurred. Reload and try again.</p>
          <p className="mt-4 text-xs text-muted">Quote this reference if you send a screenshot.</p>
          <p className="mt-1 text-sm font-semibold tracking-wide">
            Error reference{" "}
            <code className="rounded-md border border-foreground/20 bg-field px-2 py-1 font-mono text-base">
              {reference}
            </code>
          </p>
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
