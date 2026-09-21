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
  const [assignAndCheckIn, setAssignAndCheckIn] = useState(false);
  const [assignUnitId, setAssignUnitId] = useState(unitOptions[0]?.id || "");
  const [payForm, setPayForm] = useState({
    amount: "",
    paidAt: new Date().toISOString().slice(0, 10),
    method: "Transfer",
    reference: "",
  });
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

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg = "Saved.", onSuccess?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        showSnackbar(msg, "success");
        onSuccess?.();
        router.refresh();
      } else {
        showSnackbar(res.error || "Could not save.", "error");
      }
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
    <div className="rc-page !gap-4">
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
          label="In-house"
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
            <Link href={newBookingHref()} className="rc-btn rc-btn-primary">
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
        <div className="rc-empty">
          <p className="rc-empty-title">No reservations yet</p>
          <p className="rc-empty-body">
            Create your first booking — apartment assignment is optional until check-in.
          </p>
          {canManage ? (
            <Link href={newBookingHref()} className="rc-btn rc-btn-primary">
              Create first booking
            </Link>
          ) : null}
        </div>
      ) : visibleReservations.length === 0 ? (
        <p className="rc-card px-4 py-6 text-center text-[13px] text-muted">
          No reservations match your filters.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--elevated)] shadow-sm">
          <table className="rc-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Booking</th>
                <th>Source</th>
                <th>Apartment</th>
                <th>Stay</th>
                <th>Total</th>
                <th>Balance</th>
                <th>Status</th>
                {canManage ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {visibleReservations.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.guestName}</td>
                  <td className="text-[12px] text-muted">{r.bookingNumber || "—"}</td>
                  <td>{r.source}</td>
                  <td>
                    {r.hasApartment ? r.unitName : <span className="text-[var(--warn)]">{r.unitName}</span>}
                  </td>
                  <td>{r.stayLabel}</td>
                  <td>{r.totalAmountLabel}</td>
                  <td>{r.balanceLabel}</td>
                  <td>{r.status}</td>
                  {canManage ? (
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {!r.hasApartment ? (
                          <button
                            type="button"
                            disabled={isPending}
                            className="rc-btn rc-btn-secondary rc-btn-sm"
                            onClick={() => {
                              setAssignOpen(r.id);
                              setAssignAndCheckIn(false);
                              setAssignUnitId(unitOptions[0]?.id || "");
                            }}
                          >
                            Assign
                          </button>
                        ) : null}
                        {r.statusValue === "PENDING" ? (
                          <button
                            type="button"
                            disabled={isPending}
                            className="rc-btn rc-btn-secondary rc-btn-sm"
                            onClick={() =>
                              run(
                                () => updateShortletReservationStatus(tenantSlug, r.id, "CONFIRMED"),
                                "Confirmed.",
                              )
                            }
                          >
                            Confirm
                          </button>
                        ) : null}
                        {isPreArrivalStatus(r.statusValue) ? (
                          r.hasApartment ? (
                            <button
                              type="button"
                              disabled={isPending}
                              className="rc-btn rc-btn-primary rc-btn-sm"
                              onClick={() =>
                                run(
                                  () => updateShortletReservationStatus(tenantSlug, r.id, "CHECKED_IN"),
                                  "Checked in.",
                                )
                              }
                            >
                              Check in
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isPending || unitOptions.length === 0}
                              className="rc-btn rc-btn-primary rc-btn-sm"
                              onClick={() => {
                                setAssignOpen(r.id);
                                setAssignAndCheckIn(true);
                                setAssignUnitId(unitOptions[0]?.id || "");
                              }}
                            >
                              Assign & check in
                            </button>
                          )
                        ) : null}
                        {r.statusValue === "CHECKED_IN" ? (
                          <button
                            type="button"
                            disabled={isPending}
                            className="rc-btn rc-btn-primary rc-btn-sm"
                            onClick={() => setFolioOpen(r.id)}
                          >
                            Settle & check out
                          </button>
                        ) : null}
                        {isPreArrivalStatus(r.statusValue) || r.statusValue === "CHECKED_IN" ? (
                          <>
                            <button
                              type="button"
                              className="rc-btn rc-btn-ghost rc-btn-sm"
                              onClick={() => setFolioOpen(r.id)}
                            >
                              Guest bill
                            </button>
                            <button
                              type="button"
                              className="rc-btn rc-btn-ghost rc-btn-sm"
                              onClick={() => {
                                setPayOpen(r.id);
                                setPayForm({
                                  amount: "",
                                  paidAt: new Date().toISOString().slice(0, 10),
                                  method: "Transfer",
                                  reference: "",
                                });
                              }}
                            >
                              Payment
                            </button>
                            {isPreArrivalStatus(r.statusValue) ? (
                              <button
                                type="button"
                                disabled={isPending}
                                className="rc-btn rc-btn-ghost rc-btn-sm"
                                onClick={() =>
                                  run(
                                    () => updateShortletReservationStatus(tenantSlug, r.id, "NO_SHOW"),
                                    "Marked no-show.",
                                  )
                                }
                              >
                                No show
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={isPending}
                              className="rc-btn rc-btn-ghost rc-btn-sm"
                              onClick={() =>
                                run(
                                  () => updateShortletReservationStatus(tenantSlug, r.id, "CANCELLED"),
                                  "Cancelled.",
                                )
                              }
                            >
                              Cancel
                            </button>
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
          onClose={() => !isPending && setAssignOpen(null)}
          panelClassName={MODAL_PANEL_LG}
        >
          <h2 className="text-[1.125rem] font-semibold tracking-tight">
            {assignAndCheckIn ? "Assign & check in" : "Assign apartment"}
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            Choose a clean vacant apartment for this booking.
            {assignAndCheckIn ? " Guest will be checked in after assignment." : ""}
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const reservationId = assignOpen;
              const unitId = assignUnitId;
              const alsoCheckIn = assignAndCheckIn;
              run(
                async () => {
                  const assigned = await assignShortletReservationApartment(tenantSlug, {
                    reservationId,
                    unitId,
                  });
                  if (!assigned.ok) return assigned;
                  if (!alsoCheckIn) return assigned;
                  return updateShortletReservationStatus(tenantSlug, reservationId, "CHECKED_IN");
                },
                alsoCheckIn ? "Assigned and checked in." : "Apartment assigned.",
                () => {
                  setAssignOpen(null);
                  setAssignAndCheckIn(false);
                },
              );
            }}
          >
            <label className="block text-[12.5px] font-medium text-muted">
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
                onClick={() => {
                  setAssignOpen(null);
                  setAssignAndCheckIn(false);
                }}
                disabled={isPending}
                className="rc-btn rc-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !assignUnitId}
                className="rc-btn rc-btn-primary"
              >
                {isPending ? "Working…" : assignAndCheckIn ? "Assign & check in" : "Assign"}
              </button>
            </div>
          </form>
        </ModalOverlay>
      ) : null}

      {payOpen ? (
        <ModalOverlay
          open={Boolean(payOpen)}
          onClose={() => !isPending && setPayOpen(null)}
          panelClassName={MODAL_PANEL_LG}
        >
          <h2 className="text-[1.125rem] font-semibold tracking-tight">Record payment</h2>
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
                () => setPayOpen(null),
              );
            }}
          >
            <input
              type="number"
              className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
              placeholder="Amount"
              value={payForm.amount}
              onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
            <input
              type="date"
              className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
              value={payForm.paidAt}
              onChange={(e) => setPayForm((f) => ({ ...f, paidAt: e.target.value }))}
              required
            />
            <input
              className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
              placeholder="Method"
              value={payForm.method}
              onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))}
              required
            />
            <input
              className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
              placeholder="Reference (optional)"
              value={payForm.reference}
              onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayOpen(null)}
                disabled={isPending}
                className="rc-btn rc-btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" disabled={isPending} className="rc-btn rc-btn-primary">
                {isPending ? "Saving…" : "Save payment"}
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
        "rc-card-interactive p-3.5",
        active ? "border-foreground/30 ring-1 ring-foreground/15" : "",
      ].join(" ")}
    >
      <p className="rc-metric-label">{label}</p>
      <p className="rc-metric-value !text-[1.35rem]" data-zero={value === 0}>
        {value}
      </p>
    </button>
  );
}
