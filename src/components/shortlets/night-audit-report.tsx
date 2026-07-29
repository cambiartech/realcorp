"use client";

import type { NightAuditSnapshot } from "@/lib/shortlets-night-audit";

type Props = {
  tenantName: string;
  audit: NightAuditSnapshot;
  showPrintButton?: boolean;
};

export function NightAuditReport({ tenantName, audit, showPrintButton = true }: Props) {
  return (
    <div className="night-audit-report space-y-6">
      {showPrintButton ? (
        <div className="flex justify-end print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            Print night audit
          </button>
        </div>
      ) : null}

      <header className="border-b border-foreground/15 pb-4">
        <p className="text-xs uppercase tracking-wide text-muted">Night audit report</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{tenantName}</h1>
        <p className="mt-1 text-sm text-muted">Business date: {audit.businessDateLabel}</p>
        {audit.closedAtLabel ? (
          <p className="text-sm text-muted">
            Closed {audit.closedAtLabel}
            {audit.closedByLabel ? ` by ${audit.closedByLabel}` : ""}
          </p>
        ) : null}
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Occupancy" value={`${audit.summary.occupancyPercent}%`} />
        <Stat label="ADR" value={audit.summary.adrLabel} />
        <Stat label="In-house guests" value={String(audit.summary.inHouseCount)} />
        <Stat label="Total rooms" value={String(audit.summary.totalRooms)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-foreground/10 p-4">
          <h2 className="font-semibold">Housekeeping status</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Clean & vacant</span>
              <strong>{audit.housekeeping.vacantClean}</strong>
            </li>
            <li className="flex justify-between">
              <span>Dirty & vacant</span>
              <strong>{audit.housekeeping.vacantDirty}</strong>
            </li>
            <li className="flex justify-between">
              <span>Occupied</span>
              <strong>{audit.housekeeping.occupied}</strong>
            </li>
            <li className="flex justify-between">
              <span>Out of order</span>
              <strong>{audit.housekeeping.outOfOrder}</strong>
            </li>
          </ul>
        </div>
        <div className="rounded-lg border border-foreground/10 p-4">
          <h2 className="font-semibold">Tomorrow</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Expected arrivals</span>
              <strong>{audit.summary.arrivalsTomorrow}</strong>
            </li>
            <li className="flex justify-between">
              <span>Expected departures</span>
              <strong>{audit.summary.departuresTomorrow}</strong>
            </li>
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-foreground/10 p-4">
        <h2 className="font-semibold">Revenue summary</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <li>
            <span className="text-muted">Payments collected</span>
            <p className="font-semibold">{audit.revenue.paymentsCollectedLabel}</p>
          </li>
          <li>
            <span className="text-muted">Folio charges posted</span>
            <p className="font-semibold">{audit.revenue.folioChargesLabel}</p>
          </li>
          <li>
            <span className="text-muted">Outstanding balances</span>
            <p className="font-semibold">{audit.revenue.outstandingLabel}</p>
          </li>
        </ul>
        {audit.revenue.byDepartment.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-muted">Folio by department</p>
            <ul className="mt-2 space-y-1 text-sm">
              {audit.revenue.byDepartment.map((row) => (
                <li key={row.department} className="flex justify-between">
                  <span>{row.department}</span>
                  <span className="font-medium">{row.amountLabel}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-foreground/10 p-4">
        <h2 className="font-semibold">In-house guest list</h2>
        <p className="mt-1 text-sm text-muted">All guests currently checked in at close of business.</p>
        <InHouseTable guests={audit.inHouseGuests} />
      </section>
    </div>
  );
}

export function InHouseTable({
  guests,
}: {
  guests: Array<{
    guestName: string;
    unitName: string;
    checkInLabel: string;
    checkOutLabel: string;
    balanceLabel: string;
  }>;
}) {
  if (guests.length === 0) {
    return <p className="mt-4 text-sm text-muted">No guests in-house.</p>;
  }
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="py-2 pr-4">Guest</th>
            <th className="py-2 pr-4">Room</th>
            <th className="py-2 pr-4">Check-in</th>
            <th className="py-2 pr-4">Check-out</th>
            <th className="py-2">Balance</th>
          </tr>
        </thead>
        <tbody>
          {guests.map((g) => (
            <tr key={`${g.guestName}-${g.unitName}`} className="border-t border-foreground/10">
              <td className="py-2 pr-4 font-medium">{g.guestName}</td>
              <td className="py-2 pr-4">{g.unitName}</td>
              <td className="py-2 pr-4">{g.checkInLabel}</td>
              <td className="py-2 pr-4">{g.checkOutLabel}</td>
              <td className="py-2">{g.balanceLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-foreground/10 p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
