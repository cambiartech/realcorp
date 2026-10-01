"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type PlatformTenantRow = {
  slug: string;
  name: string;
  status: string;
  plan: string;
  createdLabel: string;
  memberCount: number;
  pendingInvites: number;
  availableLabel: string;
  currency: string;
};

export function PlatformTenantTable({ rows }: { rows: PlatformTenantRow[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => `${row.name} ${row.slug} ${row.status} ${row.plan}`.toLowerCase().includes(q));
  }, [query, rows]);

  return (
    <div>
      <label className="block max-w-sm text-sm">
        <span className="mb-1 block text-xs font-medium text-muted">Find an organization</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name or slug"
          className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
        />
      </label>
      <div className="mt-4 overflow-x-auto rounded-lg border border-foreground/10">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">People</th>
              <th className="px-4 py-3 font-medium">Available</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  No organization matches that search.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.slug} className="border-b border-foreground/5 last:border-b-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{row.name}</p>
                    <p className="font-mono text-xs text-muted">/{row.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{row.status}</td>
                  <td className="px-4 py-3 text-muted">{row.plan}</td>
                  <td className="px-4 py-3 text-muted">
                    {row.memberCount}
                    {row.pendingInvites > 0 ? ` · ${row.pendingInvites} invite${row.pendingInvites === 1 ? "" : "s"}` : ""}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.currency} {row.availableLabel}
                  </td>
                  <td className="px-4 py-3 text-muted">{row.createdLabel}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/platform/tenants/${row.slug}?tab=settings`}
                      className="text-xs font-semibold text-foreground underline underline-offset-2"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
