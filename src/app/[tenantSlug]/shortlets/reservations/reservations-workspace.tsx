"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useSnackbar } from "@/components/snackbar";
import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_LG, MODAL_PANEL_XL } from "@/lib/modal-panel";
import { UiSelect } from "@/components/ui-select";
import { ReservationsCalendar } from "@/components/shortlets/reservations-calendar";
import { DataExportMenu } from "@/components/shortlets/data-export-menu";
import { ReservationFolioPanel } from "@/components/shortlets/reservation-folio-panel";
import {
  createShortletReservation,
  recordShortletPayment,
  updateShortletReservationStatus,
} from "../actions";

type Reservation = {
  id: string;
  unitName: string;
  guestName: string;
  guestClientId: string | null;
  guestProfileHref: string | null;
  source: string;
  stayLabel: string;
  nights: number;
  totalAmountLabel: string;
  balanceLabel: string;
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
  folioLines: Array<{ id: string; department: string; description: string; quantity: number; amountLabel: string; postedAtLabel: string }>;
  payments: Array<{ id: string; amountLabel: string; paidAtLabel: string; method: string }>;
};

type Props = {
  tenantSlug: string;
  canManage: boolean;
  defaultCheckInTime: string;
  defaultCheckOutTime: string;
  defaultCurrency: string;
  currencies: string[];
  calendarMonth: string;
  reservations: Reservation[];
  folioByReservationId: Record<string, FolioBundle>;
  unitOptions: Array<{ id: string; label: string }>;
  projectUnitOptions: Array<{ id: string; label: string }>;
};

export function ReservationsWorkspace({
  tenantSlug,
  canManage,
  defaultCheckInTime,
  defaultCheckOutTime,
  calendarMonth: initialCalendarMonth,
  reservations,
  folioByReservationId,
  unitOptions,
}: Props) {
  const { showSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState(initialCalendarMonth);
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [folioOpen, setFolioOpen] = useState<string | null>(null);
  const [form, setForm] = useState({
    unitId: unitOptions[0]?.id || "",
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    checkIn: "",
    checkInTime: defaultCheckInTime,
    checkOut: "",
    checkOutTime: defaultCheckOutTime,
    notes: "",
    collectPaymentNow: false,
    paymentAmount: "",
    paymentPaidAt: "",
    paymentMethod: "Transfer",
    paymentReference: "",
  });
  const [payForm, setPayForm] = useState({ amount: "", paidAt: "", method: "Transfer", reference: "" });

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg = "Saved.") {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) showSnackbar(msg, "success");
      else showSnackbar(res.error || "Could not save.", "error");
    });
  }

  function openNewReservation(checkIn?: string) {
    setForm((f) => ({
      ...f,
      checkIn: checkIn || f.checkIn,
      checkOut: checkIn || f.checkOut,
    }));
    setOpen(true);
  }

  const exportRows = reservations.map((r) => ({
    guest: r.guestName,
    source: r.source,
    unit: r.unitName,
    stay: r.stayLabel,
    nights: r.nights,
    total: r.totalAmountLabel,
    balance: r.balanceLabel,
    status: r.status,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md border border-foreground/10 p-1">
          <button type="button" onClick={() => setView("list")} className={view === "list" ? "rounded bg-foreground px-3 py-1.5 text-sm text-background" : "rounded px-3 py-1.5 text-sm text-muted"}>List</button>
          <button type="button" onClick={() => setView("calendar")} className={view === "calendar" ? "rounded bg-foreground px-3 py-1.5 text-sm text-background" : "rounded px-3 py-1.5 text-sm text-muted"}>Calendar</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view === "list" ? (
            <DataExportMenu
              filename="shortlets-reservations"
              sheetName="Reservations"
              headers={["Guest", "Source", "Unit", "Stay", "Nights", "Total", "Balance", "Status"]}
              keys={["guest", "source", "unit", "stay", "nights", "total", "balance", "status"]}
              rows={exportRows}
            />
          ) : null}
          {canManage ? (
            <button type="button" onClick={() => openNewReservation()} className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background">
              New reservation
            </button>
          ) : null}
        </div>
      </div>

      {view === "calendar" ? (
        <ReservationsCalendar
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          onSelectReservation={(id) => setFolioOpen(id)}
          onSelectDay={canManage ? (date) => openNewReservation(date) : undefined}
          events={reservations
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
      ) : (
      <div className="overflow-x-auto rounded-lg border border-foreground/10">
        <table className="min-w-full text-sm">
          <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Stay</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Balance</th>
              <th className="px-4 py-3">Status</th>
              {canManage ? <th className="px-4 py-3">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.id} className="border-t border-foreground/10">
                <td className="px-4 py-3 font-medium">
                  {r.guestName}
                  {r.guestProfileHref ? (
                    <Link href={r.guestProfileHref} className="ml-2 text-xs font-normal text-muted underline hover:text-foreground">
                      Profile
                    </Link>
                  ) : null}
                </td>
                <td className="px-4 py-3">{r.source}</td>
                <td className="px-4 py-3">{r.unitName}</td>
                <td className="px-4 py-3">{r.stayLabel}</td>
                <td className="px-4 py-3">{r.totalAmountLabel}</td>
                <td className="px-4 py-3">{r.balanceLabel}</td>
                <td className="px-4 py-3">{r.status}</td>
                {canManage ? (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.statusValue === "RESERVED" ? (
                        <ActionBtn disabled={isPending} onClick={() => run(() => updateShortletReservationStatus(tenantSlug, r.id, "CHECKED_IN"), "Checked in.")}>
                          Check in
                        </ActionBtn>
                      ) : null}
                      {r.statusValue === "CHECKED_IN" ? (
                        <ActionBtn disabled={isPending} onClick={() => run(() => updateShortletReservationStatus(tenantSlug, r.id, "CHECKED_OUT"), "Checked out.")}>
                          Check out
                        </ActionBtn>
                      ) : null}
                      {r.statusValue === "RESERVED" || r.statusValue === "CHECKED_IN" ? (
                        <>
                          <ActionBtn disabled={isPending} onClick={() => setFolioOpen(r.id)}>Guest bill</ActionBtn>
                          <ActionBtn disabled={isPending} onClick={() => setPayOpen(r.id)}>Payment</ActionBtn>
                          <ActionBtn disabled={isPending} onClick={() => run(() => updateShortletReservationStatus(tenantSlug, r.id, "CANCELLED"), "Cancelled.")}>
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
        <ModalOverlay open={Boolean(folioOpen)} onClose={() => setFolioOpen(null)} panelClassName={MODAL_PANEL_XL}>
          <ReservationFolioPanel tenantSlug={tenantSlug} canManage={canManage} {...folioByReservationId[folioOpen]} />
        </ModalOverlay>
      ) : null}

      {open ? (
        <ModalOverlay open={open} onClose={() => setOpen(false)} panelClassName={MODAL_PANEL_LG}>
            <h2 className="text-lg font-bold">New reservation</h2>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    createShortletReservation(tenantSlug, {
                      unitId: form.unitId,
                      guestName: form.guestName,
                      guestEmail: form.guestEmail || undefined,
                      guestPhone: form.guestPhone || undefined,
                      checkIn: form.checkIn,
                      checkInTime: form.checkInTime,
                      checkOut: form.checkOut,
                      checkOutTime: form.checkOutTime,
                      notes: form.notes || undefined,
                      isWalkIn: false,
                      collectPaymentNow: form.collectPaymentNow,
                      paymentAmount: form.collectPaymentNow ? Number(form.paymentAmount) : undefined,
                      paymentPaidAt: form.collectPaymentNow ? form.paymentPaidAt : undefined,
                      paymentMethod: form.paymentMethod,
                      paymentReference: form.paymentReference || undefined,
                    }),
                  "Reservation created.",
                );
                setOpen(false);
              }}
            >
              <label className="block text-sm text-muted">
                Unit
                <UiSelect className="mt-1" value={form.unitId} onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}>
                  {unitOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </UiSelect>
              </label>
              <input className="w-full rounded-md border border-foreground/15 px-3 py-2 text-sm" placeholder="Guest name" value={form.guestName} onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))} required />
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="date" className="rounded-md border border-foreground/15 px-3 py-2 text-sm" value={form.checkIn} onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.value }))} required />
                <input type="time" className="rounded-md border border-foreground/15 px-3 py-2 text-sm" value={form.checkInTime} onChange={(e) => setForm((f) => ({ ...f, checkInTime: e.target.value }))} required />
                <input type="date" className="rounded-md border border-foreground/15 px-3 py-2 text-sm" value={form.checkOut} onChange={(e) => setForm((f) => ({ ...f, checkOut: e.target.value }))} required />
                <input type="time" className="rounded-md border border-foreground/15 px-3 py-2 text-sm" value={form.checkOutTime} onChange={(e) => setForm((f) => ({ ...f, checkOutTime: e.target.value }))} required />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background">Create</button>
              </div>
            </form>
        </ModalOverlay>
      ) : null}

      {payOpen ? (
        <ModalOverlay open={Boolean(payOpen)} onClose={() => setPayOpen(null)} panelClassName={MODAL_PANEL_LG}>
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
              <input type="number" className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Amount" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} required />
              <input type="date" className="w-full rounded-md border px-3 py-2 text-sm" value={payForm.paidAt} onChange={(e) => setPayForm((f) => ({ ...f, paidAt: e.target.value }))} required />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPayOpen(null)} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background">Save</button>
              </div>
            </form>
        </ModalOverlay>
      ) : null}
    </div>
  );
}

function ActionBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="rounded border border-foreground/15 px-2 py-1 text-[11px] hover:bg-foreground/[0.06] disabled:opacity-50">
      {children}
    </button>
  );
}
