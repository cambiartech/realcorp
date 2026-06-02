"use client";

import { useState } from "react";
import { platformLookupErrorReference } from "./actions";

export function ErrorReferenceLookup({ className = "mt-8" }: { className?: string }) {
  const [reference, setReference] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof platformLookupErrorReference>> | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim() || pending) return;
    setPending(true);
    const res = await platformLookupErrorReference(reference.trim());
    setResult(res);
    setPending(false);
  }

  return (
    <section className={`${className} rounded-lg border border-foreground/10 p-5`}>
      <h2 className="text-base font-semibold text-foreground">Look up reference</h2>
      <p className="mt-1 text-sm text-muted">
        Paste the error reference from the failed page, then click Look up error.
      </p>
      <form onSubmit={handleLookup} className="mt-4 flex flex-wrap gap-2">
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="1520750018"
          className="min-w-[220px] flex-1 border border-foreground/15 bg-field px-3 py-2 font-mono text-xs text-foreground"
        />
        <button
          type="submit"
          disabled={pending || !reference.trim()}
          className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Checking..." : "Look up error"}
        </button>
      </form>

      {result ? (
        <div className="mt-4 rounded-md border border-foreground/10 bg-foreground/[0.02] p-3 text-sm">
          {!result.ok ? (
            <p className="text-error">{result.error}</p>
          ) : (
            <div className="space-y-3">
              <p className="text-muted">
                <strong className="text-foreground">{result.count}</strong> report{result.count === 1 ? "" : "s"} for{" "}
                <code className="font-mono text-xs">{result.digest}</code>.
              </p>
              <div className="space-y-2">
                {result.events.map((event) => (
                  <article key={event.id} className="rounded border border-foreground/10 bg-background p-3">
                    <p className="text-xs text-muted">
                      {new Date(event.createdAt).toLocaleString()} · {event.tenantName || "Unknown tenant"}
                      {event.tenantSlug ? ` (${event.tenantSlug})` : ""}
                    </p>
                    <p className="mt-1 text-xs">
                      Route: <code className="font-mono">{event.routePath || "n/a"}</code>
                    </p>
                    {event.requestUrl ? (
                      <p className="text-xs">
                        URL: <code className="font-mono break-all">{event.requestUrl}</code>
                      </p>
                    ) : null}
                    {event.userEmail ? <p className="text-xs">User: {event.userEmail}</p> : null}
                    {event.name || event.message ? (
                      <p className="mt-1 text-xs text-foreground">
                        <strong>{event.name || "Error"}:</strong> {event.message || "No message"}
                      </p>
                    ) : null}
                    {event.stack ? (
                      <pre className="mt-2 max-h-48 overflow-auto rounded bg-foreground/[0.04] p-2 text-[10px] text-muted">
                        {event.stack}
                      </pre>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
