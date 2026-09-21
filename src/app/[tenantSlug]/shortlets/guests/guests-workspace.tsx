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
  const addHref = `/${tenantSlug}/shortlets/guests/new?returnTo=${bookingReturn}`;

  return (
    <div className="rc-page !gap-4">
      <div className="rc-page-header">
        <div className="min-w-0">
          <h2 className="rc-section-title">Short-let guests</h2>
          <p className="rc-section-hint">
            Reusable guest profiles for repeat bookings — separate from sales clients.
          </p>
        </div>
        <div className="rc-page-actions">
          <input
            type="search"
            className="min-w-[220px] rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
            placeholder="Search name, email, phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {canManage ? (
            <Link href={addHref} className="rc-btn rc-btn-primary">
              Add guest
            </Link>
          ) : null}
        </div>
      </div>

      {guests.length === 0 ? (
        <div className="rc-empty">
          <p className="rc-empty-title">No guests yet</p>
          <p className="rc-empty-body">
            Create guest profiles before booking — they can be reused across stays.
          </p>
          {canManage ? (
            <Link href={addHref} className="rc-btn rc-btn-primary">
              Add first guest
            </Link>
          ) : null}
        </div>
      ) : filtered.length === 0 ? (
        <p className="rc-card px-4 py-6 text-center text-[13px] text-muted">No guests match that search.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--elevated)] shadow-sm">
          <table className="rc-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Contact</th>
                <th>Type</th>
                <th>Stays</th>
                <th>Last stay</th>
                <th>Added</th>
                {canManage ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id}>
                  <td className="font-medium">{g.fullName}</td>
                  <td className="text-muted">
                    {g.email || g.phone || "—"}
                    {g.email && g.phone ? <span className="block text-[12px]">{g.phone}</span> : null}
                  </td>
                  <td>{g.guestType}</td>
                  <td className="num">{g.reservationCount}</td>
                  <td>{g.lastStayLabel || "—"}</td>
                  <td className="text-muted">{g.createdAtLabel}</td>
                  {canManage ? (
                    <td>
                      <Link
                        href={`/${tenantSlug}/shortlets/reservations/new?guestId=${encodeURIComponent(g.id)}`}
                        className="rc-btn rc-btn-secondary rc-btn-sm"
                      >
                        Book again
                      </Link>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
