"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type GuestRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  guestType: string;
  reservationCount: number;
  lastStayLabel: string | null;
  createdAtLabel: string;
};

type Props = {
  tenantSlug: string;
  canManage: boolean;
  guests: GuestRow[];
};

export function GuestsWorkspace({ tenantSlug, canManage, guests }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) =>
        g.fullName.toLowerCase().includes(q) ||
        (g.email?.toLowerCase().includes(q) ?? false) ||
        (g.phone?.includes(q) ?? false),
    );
  }, [guests, query]);

  const bookingReturn = encodeURIComponent(`/${tenantSlug}/shortlets/reservations/new`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Short-let guests</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Reusable guest profiles for repeat bookings — separate from sales clients. Ready for future marketplace self-service bookings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            className="min-w-[220px] rounded-md border border-foreground/15 px-3 py-2 text-sm"
            placeholder="Search name, email, phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {canManage ? (
            <Link
              href={`/${tenantSlug}/shortlets/guests/new?returnTo=${bookingReturn}`}
              className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              Add guest
            </Link>
          ) : null}
        </div>
      </div>

      {guests.length === 0 ? (
        <div className="rounded-lg border border-foreground/10 p-8 text-center">
          <p className="font-medium">No guests yet</p>
          <p className="mt-1 text-sm text-muted">Create guest profiles before booking — they can be reused across stays.</p>
          {canManage ? (
            <Link
              href={`/${tenantSlug}/shortlets/guests/new?returnTo=${bookingReturn}`}
              className="mt-4 inline-block rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              Add first guest
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-foreground/10">
          <table className="min-w-full text-sm">
            <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Stays</th>
                <th className="px-4 py-3">Last stay</th>
                <th className="px-4 py-3">Added</th>
                {canManage ? <th className="px-4 py-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} className="border-t border-foreground/10">
                  <td className="px-4 py-3 font-medium">{g.fullName}</td>
                  <td className="px-4 py-3 text-muted">
                    {g.email || g.phone || "—"}
                    {g.email && g.phone ? <span className="block text-xs">{g.phone}</span> : null}
                  </td>
                  <td className="px-4 py-3">{g.guestType}</td>
                  <td className="px-4 py-3">{g.reservationCount}</td>
                  <td className="px-4 py-3">{g.lastStayLabel || "—"}</td>
                  <td className="px-4 py-3 text-muted">{g.createdAtLabel}</td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <Link
                        href={`/${tenantSlug}/shortlets/reservations/new?guestId=${encodeURIComponent(g.id)}`}
                        className="rounded border px-2 py-1 text-xs hover:bg-foreground/[0.04]"
                      >
                        Book again
                      </Link>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No guests match your search.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
