"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { InHouseTable, NightAuditReport } from "@/components/shortlets/night-audit-report";
import { DataExportMenu } from "@/components/shortlets/data-export-menu";
import type { NightAuditSnapshot } from "@/lib/shortlets-night-audit";
import { useState, Fragment } from "react";

type Tab = "performance" | "in-house" | "night-audit";

type Props = {
  tenantSlug: string;
  tenantName: string;
  tab: Tab;
  from: string;
  to: string;
  currency: string;
  occupancyLabel: string;
  adrLabel: string;
  totalUnits: number;
  activeReservations: number;
  periodRevenueLabel: string;
  totalRevenueLabel: string;
  outstandingLabel: string;
  folioByDept: Array<{ department: string; totalLabel: string }>;
  inHouseGuests: Array<{
    guestName: string;
    unitName: string;
    checkInLabel: string;
    checkOutLabel: string;
    balanceLabel: string;
  }>;
  nightAuditHistory: Array<{
    id: string;
    dateLabel: string;
    closedAtLabel: string;
    occupancy: string;
    adr: string;
    inHouse: string;
    snapshot: NightAuditSnapshot | null;
  }>;
};

export function ReportsWorkspace(props: Props) {
  const router = useRouter();
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const tab = props.tab;

  function setTab(next: Tab) {
    const q = new URLSearchParams({ tab: next, from: props.from, to: props.to });
    router.push(`/${props.tenantSlug}/shortlets/reports?${q.toString()}`);
  }

  const performanceRows = [
    { metric: "Occupancy (now)", value: props.occupancyLabel },
    { metric: "ADR", value: props.adrLabel },
    { metric: "Active reservations", value: String(props.activeReservations) },
    { metric: "Total apartments", value: String(props.totalUnits) },
    { metric: `Revenue (${props.from} – ${props.to})`, value: props.periodRevenueLabel },
    { metric: "Revenue (all-time)", value: props.totalRevenueLabel },
    { metric: "Outstanding balance", value: props.outstandingLabel },
    ...props.folioByDept.map((r) => ({ metric: `Folio · ${r.department}`, value: r.totalLabel })),
  ];

  const inHouseRows = props.inHouseGuests.map((g) => ({
    guest: g.guestName,
    room: g.unitName,
    checkIn: g.checkInLabel,
    checkOut: g.checkOutLabel,
    balance: g.balanceLabel,
  }));

  const auditRows = props.nightAuditHistory.map((r) => ({
    date: r.dateLabel,
    closedAt: r.closedAtLabel,
    occupancy: r.occupancy,
    adr: r.adr,
    inHouse: r.inHouse,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex gap-1 border-b border-foreground/10">
          <TabBtn active={tab === "performance"} label="Performance" onClick={() => setTab("performance")} />
          <TabBtn active={tab === "in-house"} label="In-house now" onClick={() => setTab("in-house")} />
          <TabBtn active={tab === "night-audit"} label="Night audit" onClick={() => setTab("night-audit")} />
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const q = new URLSearchParams({
              tab,
              from: String(fd.get("from") || props.from),
              to: String(fd.get("to") || props.to),
            });
            router.push(`/${props.tenantSlug}/shortlets/reports?${q.toString()}`);
          }}
        >
          <label className="text-xs text-muted">
            From
            <input type="date" name="from" defaultValue={props.from} className="mt-1 block rounded-md border px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-muted">
            To
            <input type="date" name="to" defaultValue={props.to} className="mt-1 block rounded-md border px-2 py-1.5 text-sm" />
          </label>
          <button type="submit" className="rounded-md border px-3 py-1.5 text-sm">Apply</button>
        </form>
      </div>

      {tab === "performance" ? (
        <div className="space-y-6 print:space-y-4">
          <div className="flex justify-end print:hidden">
            <DataExportMenu
              filename={`shortlets-performance-${props.from}-${props.to}`}
              sheetName="Performance"
              headers={["Metric", "Value"]}
              keys={["metric", "value"]}
              rows={performanceRows}
              reportTitle="Short Lets Performance"
              companyName={props.tenantName}
              periodLabel={`${props.from} – ${props.to}`}
              currency={props.currency}
              kpis={[
                { label: "Occupancy", value: props.occupancyLabel, tone: "highlight" },
                { label: "ADR", value: props.adrLabel },
                { label: "Period revenue", value: props.periodRevenueLabel, tone: "positive" },
                { label: "Outstanding", value: props.outstandingLabel, tone: "negative" },
              ]}
              breakdowns={[
                {
                  title: "Folio revenue by department",
                  rows: props.folioByDept.map((r) => ({
                    label: r.department,
                    value: parseFloat(r.totalLabel.replace(/[^\d.-]/g, "")) || 0,
                  })),
                },
              ]}
            />
          </div>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Occupancy (now)" value={props.occupancyLabel} />
            <Card label="ADR" value={props.adrLabel} />
            <Card label="Active reservations" value={String(props.activeReservations)} />
            <Card label="Total apartments" value={String(props.totalUnits)} />
          </section>
          <section className="grid gap-3 sm:grid-cols-3">
            <Card label={`Revenue (${props.from} – ${props.to})`} value={props.periodRevenueLabel} />
            <Card label="Revenue (all-time)" value={props.totalRevenueLabel} />
            <Card label="Outstanding balance" value={props.outstandingLabel} />
          </section>
          {props.folioByDept.length > 0 ? (
            <section className="rounded-lg border border-foreground/10 p-4">
              <h2 className="font-semibold">Folio revenue by department</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {props.folioByDept.map((row) => (
                  <li key={row.department} className="flex justify-between">
                    <span>{row.department}</span>
                    <span className="font-medium">{row.totalLabel}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === "in-house" ? (
        <section className="rounded-lg border border-foreground/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">In-house guest list</h2>
              <p className="mt-1 text-sm text-muted">Live list of all checked-in guests — print for security or front desk.</p>
            </div>
            <DataExportMenu
              filename="shortlets-in-house"
              sheetName="In-house guests"
              headers={["Guest", "Room", "Check-in", "Check-out", "Balance"]}
              keys={["guest", "room", "checkIn", "checkOut", "balance"]}
              rows={inHouseRows}
              reportTitle="In-house Guest List"
              companyName={props.tenantName}
              kpis={[
                { label: "Guests in-house", value: inHouseRows.length, tone: "highlight" },
                { label: "Occupancy", value: props.occupancyLabel },
              ]}
            />
          </div>
          <InHouseTable guests={props.inHouseGuests} />
        </section>
      ) : null}

      {tab === "night-audit" ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              End-of-day closes save a full night audit. Open any closed day to view or print the manager report — not raw data.
            </p>
            <DataExportMenu
              filename="shortlets-night-audit-history"
              sheetName="Night audit"
              headers={["Business date", "Closed at", "Occupancy", "ADR", "In-house"]}
              keys={["date", "closedAt", "occupancy", "adr", "inHouse"]}
              rows={auditRows}
              showPdf={false}
              reportTitle="Night Audit History"
              companyName={props.tenantName}
              periodLabel={`${props.from} – ${props.to}`}
              kpis={[{ label: "Closed days", value: auditRows.length, tone: "highlight" }]}
            />
          </div>
          <div className="overflow-x-auto rounded-lg border border-foreground/10">
            <table className="min-w-full text-sm">
              <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Business date</th>
                  <th className="px-4 py-3">Closed at</th>
                  <th className="px-4 py-3">Occupancy</th>
                  <th className="px-4 py-3">ADR</th>
                  <th className="px-4 py-3">In-house</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {props.nightAuditHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-muted">
                      No night audits yet. Run end of day from Settings when the business day closes.
                    </td>
                  </tr>
                ) : (
                  props.nightAuditHistory.map((row) => (
                    <Fragment key={row.id}>
                      <tr className="border-t border-foreground/10">
                        <td className="px-4 py-3 font-medium">{row.dateLabel}</td>
                        <td className="px-4 py-3">{row.closedAtLabel}</td>
                        <td className="px-4 py-3">{row.occupancy}</td>
                        <td className="px-4 py-3">{row.adr}</td>
                        <td className="px-4 py-3">{row.inHouse}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setExpandedAuditId(expandedAuditId === row.id ? null : row.id)}
                              className="rounded border px-2 py-1 text-xs hover:bg-foreground/[0.06]"
                            >
                              {expandedAuditId === row.id ? "Hide" : "View report"}
                            </button>
                            <Link
                              href={`/${props.tenantSlug}/shortlets/reports/night-audit/${row.id}`}
                              className="rounded border px-2 py-1 text-xs hover:bg-foreground/[0.06]"
                            >
                              Open / print
                            </Link>
                          </div>
                        </td>
                      </tr>
                      {expandedAuditId === row.id && row.snapshot ? (
                        <tr className="border-t border-foreground/10 bg-foreground/[0.02]">
                          <td colSpan={6} className="px-4 py-6">
                            <NightAuditReport tenantName={props.tenantName} audit={row.snapshot} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TabBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "border-b-2 px-3 py-2 text-sm transition-colors",
        active ? "border-foreground font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-foreground/10 p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
