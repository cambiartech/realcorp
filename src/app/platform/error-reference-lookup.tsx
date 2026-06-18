"use client";

import { useState } from "react";
import { platformLookupErrorReference } from "./actions";

function EventCard({
  event,
  highlight,
}: {
  event: {
    id: string;
    createdAt: string;
    tenantSlug: string | null;
    tenantName: string | null;
    routePath: string | null;
    requestUrl: string | null;
    name: string | null;
    message: string | null;
    userEmail: string | null;
    stack: string | null;
    source: string | null;
    isSanitized?: boolean;
  };
  highlight?: boolean;
}) {
  return (
    <article
      className={[
        "rounded border bg-background p-3",
        highlight ? "border-foreground/25 ring-1 ring-foreground/10" : "border-foreground/10",
      ].join(" ")}
    >
      <p className="text-xs text-muted">
        {new Date(event.createdAt).toLocaleString()} · {event.tenantName || "Unknown tenant"}
        {event.tenantSlug ? ` (${event.tenantSlug})` : ""}
        {event.source ? ` · ${event.source}` : ""}
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
      {event.isSanitized ? (
        <p className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-foreground">
          Browser-only report — Next.js hides the real message in production. Check the highlighted server report below or Netlify runtime logs.
        </p>
      ) : null}
      {event.name || event.message ? (
        <p className="mt-2 text-xs text-foreground">
          <strong>{event.name || "Error"}:</strong> {event.message || "No message"}
        </p>
      ) : null}
      {event.stack ? (
        <pre className="mt-2 max-h-64 overflow-auto rounded bg-foreground/[0.04] p-2 text-[10px] leading-relaxed text-muted whitespace-pre-wrap">
          {event.stack}
        </pre>
      ) : null}
    </article>
  );
}

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
        Paste the error reference from the failed page. After deploy, server-side captures include the real message and stack — not the generic browser text.
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
            <div className="space-y-4">
              <p className="text-muted">
                <strong className="text-foreground">{result.count}</strong> report{result.count === 1 ? "" : "s"} for{" "}
                <code className="font-mono text-xs">{result.digest}</code>.
              </p>

              {!result.hasActionableDetail ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
                  <p className="font-medium">Only generic browser reports on file for this reference.</p>
                  <p className="mt-1 text-muted">
                    Reproduce the error once after the latest deploy, then look up again — or open{" "}
                    <strong className="text-foreground">Netlify → Site → Logs → Runtime</strong> and search for{" "}
                    <code className="font-mono">{result.digest}</code> or{" "}
                    <code className="font-mono">[onRequestError]</code>.
                  </p>
                </div>
              ) : null}

              {result.bestEvent ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">Most useful report</p>
                  <EventCard
                    event={{
                      ...result.bestEvent,
                      isSanitized: false,
                    }}
                    highlight
                  />
                </div>
              ) : null}

              {result.events.length > 1 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">All reports</p>
                  <div className="space-y-2">
                    {result.events.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
