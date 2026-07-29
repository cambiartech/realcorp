"use client";

import { useState } from "react";
import { platformLookupInviteToken } from "./actions";

export function InviteTokenLookup() {
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof platformLookupInviteToken>> | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim() || pending) return;
    setPending(true);
    const res = await platformLookupInviteToken(token.trim());
    setResult(res);
    setPending(false);
  }

  return (
    <section className="rounded-lg border border-foreground/10 p-5">
      <h2 className="text-base font-semibold text-foreground">Investigate a broken link</h2>
      <p className="mt-1 text-sm text-muted">
        Paste the token from a failed URL (everything after <code className="text-xs">?token=</code>) to see
        why it failed.
      </p>
      <form onSubmit={handleLookup} className="mt-4 flex flex-wrap gap-2">
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="8c88f7e97284fa…"
          className="min-w-[280px] flex-1 border border-foreground/15 bg-field px-3 py-2 font-mono text-xs text-foreground"
        />
        <button
          type="submit"
          disabled={pending || !token.trim()}
          className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Checking…" : "Look up token"}
        </button>
      </form>
      {result ? (
        <div className="mt-4 rounded-md border border-foreground/10 bg-foreground/[0.02] p-3 text-sm">
          {!result.ok ? (
            <p className="text-error">{result.error}</p>
          ) : (
            <ul className="space-y-1 text-muted">
              <li>
                Status: <strong className="text-foreground">{result.status}</strong>
              </li>
              {result.tenantName ? (
                <li>
                  Organization: <strong className="text-foreground">{result.tenantName}</strong>
                </li>
              ) : null}
              {result.email ? (
                <li>
                  Email: <strong className="text-foreground">{result.email}</strong>
                </li>
              ) : null}
              {result.expiresAt ? <li>Expires: {new Date(result.expiresAt).toLocaleString()}</li> : null}
              {result.acceptedAt ? <li>Accepted: {new Date(result.acceptedAt).toLocaleString()}</li> : null}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
