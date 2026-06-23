"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSnackbar } from "@/components/snackbar";
import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_LG, MODAL_PANEL_XL } from "@/lib/modal-panel";
import { UiSelect } from "@/components/ui-select";
import { InHouseTable } from "@/components/shortlets/night-audit-report";
import { ReservationFolioPanel, type FolioLineRow, type FolioPaymentRow } from "@/components/shortlets/reservation-folio-panel";
import { createShortletReservation, updateShortletReservationStatus } from "../actions";
import { isPreArrivalStatus } from "@/lib/shortlets-reservation-status";

type Arrival = {
  id: string;
  guestName: string;
  unitName: string;
  checkInLabel: string;
  status: string;
  statusValue: string;
  hasApartment: boolean;
};

type DepartureFolio = {
  reservationId: string;
  guestName: string;
  unitName: string;
  totalAmountLabel: string;
  paidAmountLabel: string;
  balanceLabel: string;
  balanceDue: number;
  currency: string;
  folioLines: FolioLineRow[];
  payments: FolioPaymentRow[];
};

type Departure = {
  id: string;
  guestName: string;
  unitName: string;
  checkOutLabel: string;
  balanceLabel: string;
  alertLevel: "normal" | "due-soon" | "overdue";
  folio: DepartureFolio | null;
};

type Props = {
  tenantSlug: string;
  canManage: boolean;
  defaultCheckInTime: string;
  defaultCheckOutTime: string;
  arrivals: Arrival[];
  departures: Departure[];
  inHouseGuests: Array<{
    guestName: string;
    unitName: string;
    checkInLabel: string;
    checkOutLabel: string;
    balanceLabel: string;
  }>;
  walkInUnitOptions: Array<{ id: string; label: string }>;
  currencies: string[];
  defaultCurrency: string;
};

export function FrontDeskWorkspace({
  tenantSlug,
  canManage,
  defaultCheckInTime,
  defaultCheckOutTime,
  arrivals,
  departures,
  inHouseGuests,
  walkInUnitOptions,
}: Props) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [form, setForm] = useState({
    unitId: walkInUnitOptions[0]?.id || "",
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    checkIn: new Date().toISOString().slice(0, 10),
    checkInTime: defaultCheckInTime,
    checkOut: "",
    checkOutTime: defaultCheckOutTime,
    notes: "",
    collectPaymentNow: false,
    paymentAmount: "",
    paymentPaidAt: new Date().toISOString().slice(0, 10),
    paymentMethod: "Transfer",
    paymentReference: "",
  });

  const checkoutDeparture = departures.find((d) => d.id === checkoutId);
  const checkoutFolio = checkoutDeparture?.folio;

  function runAction(fn: () => Promise<{ ok: boolean; error?: string }>, success = "Saved.", refresh = true) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        showSnackbar(success, "success");
        if (refresh) router.refresh();
      } else {
        showSnackbar(res.error || "Could not save.", "error");
      }
    });
  }

  return (
    <div className="space-y-8">
      {canManage ? (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md border border-foreground/15 px-4 py-2 text-sm"
          >
            Print in-house list
          </button>
          <button
            type="button"
            onClick={() => setWalkInOpen(true)}
            className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
          >
            Walk-in check-in
          </button>
        </div>
      ) : null}

      <section className="rounded-lg border border-foreground/10 p-4 print:border-none">
        <h2 className="text-lg font-semibold text-foreground">In-house now</h2>
        <p className="mt-1 text-sm text-muted">{inHouseGuests.length} guest(s) currently checked in.</p>
        <div className="mt-4">
          <InHouseTable guests={inHouseGuests} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Today&apos;s arrivals</h2>
        <p className="mt-1 text-sm text-muted">Guests expected to check in today.</p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-foreground/10">
          <table className="min-w-full text-sm">
            <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Apartment</th>
                <th className="px-4 py-3">Check-in</th>
                <th className="px-4 py-3">Status</th>
                {canManage ? <th className="px-4 py-3">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {arrivals.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="px-4 py-6 text-muted">No arrivals scheduled for today.</td>
                </tr>
              ) : (
                arrivals.map((row) => (
                  <tr key={row.id} className="border-t border-foreground/10">
                    <td className="px-4 py-3 font-medium">{row.guestName}</td>
                    <td className="px-4 py-3">{row.unitName}</td>
                    <td className="px-4 py-3">{row.checkInLabel}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    {canManage ? (
                      <td className="px-4 py-3">
                        {isPreArrivalStatus(row.statusValue) ? (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => runAction(() => updateShortletReservationStatus(tenantSlug, row.id, "CHECKED_IN"), "Guest checked in.")}
                            className="rounded border border-foreground/15 px-2 py-1 text-xs hover:bg-foreground/[0.06]"
                          >
                            {row.hasApartment ? "Check in" : "Assign & check in"}
                          </button>
                        ) : "—"}
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground">Today&apos;s departures</h2>
        <p className="mt-1 text-sm text-muted">Review folio and settle balance before checkout.</p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-foreground/10">
          <table className="min-w-full text-sm">
            <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Apartment</th>
                <th className="px-4 py-3">Check-out</th>
                <th className="px-4 py-3">Balance</th>
                {canManage ? <th className="px-4 py-3">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {departures.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="px-4 py-6 text-muted">No departures scheduled for today.</td>
                </tr>
              ) : (
                departures.map((row) => (
                  <tr
                    key={row.id}
                    className={[
                      "border-t border-foreground/10",
                      row.alertLevel === "overdue" ? "bg-red-500/10" : row.alertLevel === "due-soon" ? "bg-amber-500/10" : "",
                    ].join(" ")}
                  >
                    <td className="px-4 py-3 font-medium">{row.guestName}</td>
                    <td className="px-4 py-3">{row.unitName}</td>
                    <td className="px-4 py-3">{row.checkOutLabel}</td>
                    <td className="px-4 py-3">{row.balanceLabel}</td>
                    {canManage ? (
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setCheckoutId(row.id)}
                          className="rounded border border-foreground/15 px-2 py-1 text-xs hover:bg-foreground/[0.06]"
                        >
                          Settle & check out
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {walkInOpen ? (
        <ModalOverlay open={walkInOpen} onClose={() => setWalkInOpen(false)} panelClassName={MODAL_PANEL_LG}>
            <h2 className="text-lg font-bold">Walk-in check-in</h2>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                runAction(
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
                      isWalkIn: true,
                      collectPaymentNow: form.collectPaymentNow,
                      paymentAmount: form.collectPaymentNow ? Number(form.paymentAmount) : undefined,
                      paymentPaidAt: form.collectPaymentNow ? form.paymentPaidAt : undefined,
                      paymentMethod: form.paymentMethod,
                      paymentReference: form.paymentReference || undefined,
                    }),
                  "Walk-in checked in.",
                );
                setWalkInOpen(false);
              }}
            >
              <label className="block text-sm text-muted">
                Apartment
                <UiSelect className="mt-1" value={form.unitId} onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}>
                  {walkInUnitOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </UiSelect>
              </label>
              <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Guest name" value={form.guestName} onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))} required />
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="date" className="rounded-md border px-3 py-2 text-sm" value={form.checkIn} onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.value }))} required />
                <input type="time" className="rounded-md border px-3 py-2 text-sm" value={form.checkInTime} onChange={(e) => setForm((f) => ({ ...f, checkInTime: e.target.value }))} required />
                <input type="date" className="rounded-md border px-3 py-2 text-sm" value={form.checkOut} onChange={(e) => setForm((f) => ({ ...f, checkOut: e.target.value }))} required />
                <input type="time" className="rounded-md border px-3 py-2 text-sm" value={form.checkOutTime} onChange={(e) => setForm((f) => ({ ...f, checkOutTime: e.target.value }))} required />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setWalkInOpen(false)} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background">Check in now</button>
              </div>
            </form>
        </ModalOverlay>
      ) : null}

      {checkoutId && checkoutFolio ? (
        <ModalOverlay open={Boolean(checkoutId)} onClose={() => setCheckoutId(null)} panelClassName={MODAL_PANEL_XL}>
            <h2 className="text-lg font-bold">Checkout settlement</h2>
            <p className="mt-1 text-sm text-muted">Review all folio charges and payments before releasing the room.</p>
            <div className="mt-4">
              <ReservationFolioPanel
                tenantSlug={tenantSlug}
                canManage={canManage}
                reservationId={checkoutFolio.reservationId}
                guestName={checkoutFolio.guestName}
                unitName={checkoutFolio.unitName}
                totalAmountLabel={checkoutFolio.totalAmountLabel}
                paidAmountLabel={checkoutFolio.paidAmountLabel}
                balanceLabel={checkoutFolio.balanceLabel}
                balanceDue={checkoutFolio.balanceDue}
                currency={checkoutFolio.currency}
                folioLines={checkoutFolio.folioLines}
                payments={checkoutFolio.payments}
                checkoutPending={isPending}
                onCheckout={() => {
                  runAction(
                    () => updateShortletReservationStatus(tenantSlug, checkoutId, "CHECKED_OUT"),
                    "Guest checked out.",
                  );
                  setCheckoutId(null);
                }}
              />
            </div>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
