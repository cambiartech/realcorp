"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useSnackbar } from "@/components/snackbar";
import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_LG, MODAL_PANEL_XL } from "@/lib/modal-panel";
import { UiSelect } from "@/components/ui-select";
import { isPreArrivalStatus } from "@/lib/shortlets-reservation-status";
import { ReservationsCalendar } from "@/components/shortlets/reservations-calendar";
import { DataExportMenu } from "@/components/shortlets/data-export-menu";
import { ReservationFolioPanel } from "@/components/shortlets/reservation-folio-panel";
import {
  assignShortletReservationApartment,
  recordShortletPayment,
  updateShortletReservationStatus,
} from "../actions";

type Reservation = {
  id: string;
  bookingNumber: string | null;
  unitName: string;
  hasApartment: boolean;
  guestName: string;
  source: string;
  stayLabel: string;
  nights: number;
  totalAmountLabel: string;
  balanceLabel: string;
  cautionFeeLabel: string | null;
  status: string;
  statusValue: string;
  checkIn: string;
  checkOut: string;
};

type FolioBundle = {
  reservationId: string;
  guestName: string;
  unitName: string;
  totalAmountLabel: string;
  paidAmountLabel: string;
  balanceLabel: string;
  balanceDue: number;
  currency: string;
  folioLines: Array<{
    id: string;
    department: string;
    description: string;
    quantity: number;
    amountLabel: string;
    postedAtLabel: string;
  }>;
  payments: Array<{ id: string; amountLabel: string; paidAtLabel: string; method: string }>;
};

type Props = {
  tenantSlug: string;
  canManage: boolean;
  calendarMonth: string;
  reservations: Reservation[];
  folioByReservationId: Record<string, FolioBundle>;
  unitOptions: Array<{ id: string; label: string }>;
};

export function ReservationsWorkspace({
  tenantSlug,
  canManage,
  calendarMonth: initialCalendarMonth,
  reservations,
  folioByReservationId,
  unitOptions,
}: Props) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState(initialCalendarMonth);
  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [folioOpen, setFolioOpen] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [assignUnitId, setAssignUnitId] = useState(unitOptions[0]?.id || "");
  const [payForm, setPayForm] = useState({ amount: "", paidAt: "", method: "Transfer", reference: "" });
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const kpis = useMemo(() => {
    const count = (s: string) => reservations.filter((r) => r.statusValue === s).length;
    return {
      total: reservations.length,
      pending: count("PENDING"),
      confirmed: count("CONFIRMED") + count("RESERVED"),
      checkedIn: count("CHECKED_IN"),
      checkedOut: count("CHECKED_OUT"),
      noShow: count("NO_SHOW"),
    };
  }, [reservations]);

  const visibleReservations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reservations.filter((r) => {
      if (statusFilter !== "ALL") {
        if (statusFilter === "CONFIRMED") {
          if (r.statusValue !== "CONFIRMED" && r.statusValue !== "RESERVED") return false;
        } else if (r.statusValue !== statusFilter) return false;
      }
      if (!q) return true;
      return (
        r.guestName.toLowerCase().includes(q) ||
        (r.bookingNumber?.toLowerCase().includes(q) ?? false) ||
        r.unitName.toLowerCase().includes(q)
      );
    });
  }, [reservations, statusFilter, search]);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg = "Saved.") {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) showSnackbar(msg, "success");
      else showSnackbar(res.error || "Could not save.", "error");
    });
  }

  const newBookingHref = (checkIn?: string) => {
    const base = `/${tenantSlug}/shortlets/reservations/new`;
    return checkIn
      ? `${base}?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkIn)}`
      : base;
  };

  const exportRows = reservations.map((r) => ({
    guest: r.guestName,
    booking: r.bookingNumber || "",
    source: r.source,
    apartment: r.unitName,
    stay: r.stayLabel,
    nights: r.nights,
    total: r.totalAmountLabel,
    balance: r.balanceLabel,
    status: r.status,
  }));

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <KpiCard
          label="Total"
          value={kpis.total}
          active={statusFilter === "ALL"}
          onClick={() => setStatusFilter("ALL")}
        />
        <KpiCard
          label="Pending"
          value={kpis.pending}
          active={statusFilter === "PENDING"}
          onClick={() => setStatusFilter("PENDING")}
        />
        <KpiCard
          label="Confirmed"
          value={kpis.confirmed}
          active={statusFilter === "CONFIRMED"}
          onClick={() => setStatusFilter("CONFIRMED")}
        />
        <KpiCard
          label="Checked in"
          value={kpis.checkedIn}
          active={statusFilter === "CHECKED_IN"}
          onClick={() => setStatusFilter("CHECKED_IN")}
        />
        <KpiCard
          label="Checked out"
          value={kpis.checkedOut}
          active={statusFilter === "CHECKED_OUT"}
          onClick={() => setStatusFilter("CHECKED_OUT")}
        />
        <KpiCard
          label="No shows"
          value={kpis.noShow}
          active={statusFilter === "NO_SHOW"}
          onClick={() => setStatusFilter("NO_SHOW")}
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md border border-foreground/10 p-1">
          <button
            type="button"
            onClick={() => setView("list")}
            className={
              view === "list"
                ? "rounded bg-foreground px-3 py-1.5 text-sm text-background"
                : "rounded px-3 py-1.5 text-sm text-muted"
            }
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setView("calendar")}
            className={
              view === "calendar"
                ? "rounded bg-foreground px-3 py-1.5 text-sm text-background"
                : "rounded px-3 py-1.5 text-sm text-muted"
            }
          >
            Calendar
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view === "list" ? (
            <input
              type="search"
              className="rounded-md border border-foreground/15 px-3 py-2 text-sm"
              placeholder="Search guest, booking #, apartment…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          ) : null}
          {view === "list" ? (
            <DataExportMenu
              filename="shortlets-reservations"
              sheetName="Reservations"
              headers={[
                "Guest",
                "Booking",
                "Source",
                "Apartment",
                "Stay",
                "Nights",
                "Total",
                "Balance",
                "Status",
              ]}
              keys={[
                "guest",
                "booking",
                "source",
                "apartment",
                "stay",
                "nights",
                "total",
                "balance",
                "status",
              ]}
              rows={exportRows}
            />
          ) : null}
          {canManage ? (
            <Link
              href={newBookingHref()}
              className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              New booking
            </Link>
          ) : null}
        </div>
      </div>

      {view === "calendar" ? (
        <ReservationsCalendar
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          onSelectReservation={(id) => setFolioOpen(id)}
          onSelectDay={canManage ? (date) => router.push(newBookingHref(date)) : undefined}
          events={visibleReservations
            .filter((r) => r.statusValue !== "CANCELLED")
            .map((r) => ({
              id: r.id,
              guestName: r.guestName,
              unitName: r.unitName,
              checkIn: r.checkIn,
              checkOut: r.checkOut,
              status: r.status,
            }))}
        />
      ) : reservations.length === 0 ? (
        <div className="rounded-lg border border-foreground/10 p-8 text-center">
          <p className="font-medium">No reservations yet</p>
          <p className="mt-1 text-sm text-muted">
            Create your first booking — apartment assignment is optional until check-in.
          </p>
          {canManage ? (
            <Link
              href={newBookingHref()}
              className="mt-4 inline-block rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              Create first booking
            </Link>
          ) : null}
        </div>
      ) : visibleReservations.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 p-6 text-sm text-muted">
          No reservations match your filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-foreground/10">
          <table className="min-w-full text-sm">
            <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Apartment</th>
                <th className="px-4 py-3">Stay</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Status</th>
                {canManage ? <th className="px-4 py-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {visibleReservations.map((r) => (
                <tr key={r.id} className="border-t border-foreground/10">
                  <td className="px-4 py-3 font-medium">{r.guestName}</td>
                  <td className="px-4 py-3 text-xs text-muted">{r.bookingNumber || "—"}</td>
                  <td className="px-4 py-3">{r.source}</td>
                  <td className="px-4 py-3">
                    {r.hasApartment ? r.unitName : <span className="text-[var(--warn)]">{r.unitName}</span>}
                  </td>
                  <td className="px-4 py-3">{r.stayLabel}</td>
                  <td className="px-4 py-3">{r.totalAmountLabel}</td>
                  <td className="px-4 py-3">{r.balanceLabel}</td>
                  <td className="px-4 py-3">{r.status}</td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {!r.hasApartment ? (
                          <ActionBtn
                            disabled={isPending}
                            onClick={() => {
                              setAssignOpen(r.id);
                              setAssignUnitId(unitOptions[0]?.id || "");
                            }}
                          >
                            Assign apartment
                          </ActionBtn>
                        ) : null}
                        {r.statusValue === "PENDING" ? (
                          <ActionBtn
                            disabled={isPending}
                            onClick={() =>
                              run(
                                () => updateShortletReservationStatus(tenantSlug, r.id, "CONFIRMED"),
                                "Confirmed.",
                              )
                            }
                          >
                            Confirm
                          </ActionBtn>
                        ) : null}
                        {isPreArrivalStatus(r.statusValue) ? (
                          <ActionBtn
                            disabled={isPending}
                            onClick={() =>
                              run(
                                () => updateShortletReservationStatus(tenantSlug, r.id, "CHECKED_IN"),
                                "Checked in.",
                              )
                            }
                          >
                            Check in
                          </ActionBtn>
                        ) : null}
                        {r.statusValue === "CHECKED_IN" ? (
                          <ActionBtn
                            disabled={isPending}
                            onClick={() =>
                              run(
                                () => updateShortletReservationStatus(tenantSlug, r.id, "CHECKED_OUT"),
                                "Checked out.",
                              )
                            }
                          >
                            Check out
                          </ActionBtn>
                        ) : null}
                        {isPreArrivalStatus(r.statusValue) || r.statusValue === "CHECKED_IN" ? (
                          <>
                            <ActionBtn disabled={isPending} onClick={() => setFolioOpen(r.id)}>
                              Guest bill
                            </ActionBtn>
                            <ActionBtn disabled={isPending} onClick={() => setPayOpen(r.id)}>
                              Payment
                            </ActionBtn>
                            {isPreArrivalStatus(r.statusValue) ? (
                              <ActionBtn
                                disabled={isPending}
                                onClick={() =>
                                  run(
                                    () => updateShortletReservationStatus(tenantSlug, r.id, "NO_SHOW"),
                                    "Marked no-show.",
                                  )
                                }
                              >
                                No show
                              </ActionBtn>
                            ) : null}
                            <ActionBtn
                              disabled={isPending}
                              onClick={() =>
                                run(
                                  () => updateShortletReservationStatus(tenantSlug, r.id, "CANCELLED"),
                                  "Cancelled.",
                                )
                              }
                            >
                              Cancel
                            </ActionBtn>
                          </>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {folioOpen && folioByReservationId[folioOpen] ? (
        <ModalOverlay
          open={Boolean(folioOpen)}
          onClose={() => setFolioOpen(null)}
          panelClassName={MODAL_PANEL_XL}
        >
          <ReservationFolioPanel
            tenantSlug={tenantSlug}
            canManage={canManage}
            {...folioByReservationId[folioOpen]}
          />
        </ModalOverlay>
      ) : null}

      {assignOpen ? (
        <ModalOverlay
          open={Boolean(assignOpen)}
          onClose={() => setAssignOpen(null)}
          panelClassName={MODAL_PANEL_LG}
        >
          <h2 className="text-lg font-bold">Assign apartment</h2>
          <p className="mt-1 text-sm text-muted">
            Choose a short-let apartment for this booking. Pricing will be calculated from the apartment
            rates.
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  assignShortletReservationApartment(tenantSlug, {
                    reservationId: assignOpen,
                    unitId: assignUnitId,
                  }),
                "Apartment assigned.",
              );
              setAssignOpen(null);
            }}
          >
            <label className="block text-sm text-muted">
              Apartment
              <UiSelect
                className="mt-1"
                value={assignUnitId}
                onChange={(e) => setAssignUnitId(e.target.value)}
                required
              >
                {unitOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </UiSelect>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignOpen(null)}
                className="rounded-md border px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !assignUnitId}
                className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background"
              >
                Assign
              </button>
            </div>
          </form>
        </ModalOverlay>
      ) : null}

      {payOpen ? (
        <ModalOverlay
          open={Boolean(payOpen)}
          onClose={() => setPayOpen(null)}
          panelClassName={MODAL_PANEL_LG}
        >
          <h2 className="text-lg font-bold">Record payment</h2>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  recordShortletPayment(tenantSlug, payOpen, {
                    amount: Number(payForm.amount),
                    paidAt: payForm.paidAt,
                    method: payForm.method,
                    reference: payForm.reference || undefined,
                  }),
                "Payment recorded.",
              );
              setPayOpen(null);
            }}
          >
            <input
              type="number"
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Amount"
              value={payForm.amount}
              onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
            <input
              type="date"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={payForm.paidAt}
              onChange={(e) => setPayForm((f) => ({ ...f, paidAt: e.target.value }))}
              required
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayOpen(null)}
                className="rounded-md border px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background"
              >
                Save
              </button>
            </div>
          </form>
        </ModalOverlay>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg border p-4 text-left transition-colors",
        active ? "border-foreground bg-foreground/[0.04]" : "border-foreground/10 hover:border-foreground/20",
      ].join(" ")}
    >
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </button>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-foreground/15 px-2 py-1 text-[11px] hover:bg-foreground/[0.06] disabled:opacity-50"
    >
      {children}
    </button>
  );
}
