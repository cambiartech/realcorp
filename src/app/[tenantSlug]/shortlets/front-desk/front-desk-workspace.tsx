"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSnackbar } from "@/components/snackbar";
import { ModalOverlay } from "@/components/modal-overlay";
import { PdfDownloadButton } from "@/components/pdf-download-button";
import { MODAL_PANEL_LG, MODAL_PANEL_XL } from "@/lib/modal-panel";
import { UiSelect } from "@/components/ui-select";
import { InHouseTable } from "@/components/shortlets/night-audit-report";
import {
  ReservationFolioPanel,
  type FolioLineRow,
  type FolioPaymentRow,
} from "@/components/shortlets/reservation-folio-panel";
import {
  assignShortletReservationApartment,
  createShortletReservation,
  updateShortletReservationStatus,
} from "../actions";
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
  const [assignCheckIn, setAssignCheckIn] = useState<{ id: string; guestName: string } | null>(null);
  const [assignUnitId, setAssignUnitId] = useState(walkInUnitOptions[0]?.id || "");
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

  function runAction(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    success = "Saved.",
    onSuccess?: () => void,
  ) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        showSnackbar(success, "success");
        onSuccess?.();
        router.refresh();
      } else {
        showSnackbar(res.error || "Could not save.", "error");
      }
    });
  }

  function openAssignCheckIn(row: Arrival) {
    setAssignCheckIn({ id: row.id, guestName: row.guestName });
    setAssignUnitId(walkInUnitOptions[0]?.id || "");
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <div className="flex flex-wrap justify-end gap-2">
          <PdfDownloadButton
            targetSelector="[data-front-desk-in-house='true']"
            filename={`in-house-guests-${new Date().toISOString().slice(0, 10)}`}
            className="rc-btn rc-btn-secondary"
          >
            Download in-house PDF
          </PdfDownloadButton>
          <button
            type="button"
            onClick={() => setWalkInOpen(true)}
            disabled={walkInUnitOptions.length === 0}
            title={
              walkInUnitOptions.length === 0
                ? "No clean vacant apartments — mark a room clean on the Room board first"
                : undefined
            }
            className="rc-btn rc-btn-primary"
          >
            Walk-in check-in
          </button>
        </div>
      ) : null}

      <section
        data-front-desk-in-house="true"
        className="rc-card p-4 print:border-none print:shadow-none"
      >
        <h2 className="rc-section-title">In-house now</h2>
        <p className="rc-section-hint">{inHouseGuests.length} guest(s) currently checked in.</p>
        <div className="mt-4">
          <InHouseTable guests={inHouseGuests} />
        </div>
      </section>

      <section>
        <h2 className="rc-section-title">Today&apos;s arrivals</h2>
        <p className="rc-section-hint">Guests expected to check in today.</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--elevated)] shadow-sm">
          <table className="rc-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Apartment</th>
                <th>Check-in</th>
                <th>Status</th>
                {canManage ? <th>Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {arrivals.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="nil">
                    No arrivals scheduled for today.
                  </td>
                </tr>
              ) : (
                arrivals.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">{row.guestName}</td>
                    <td>{row.unitName}</td>
                    <td>{row.checkInLabel}</td>
                    <td>{row.status}</td>
                    {canManage ? (
                      <td>
                        {isPreArrivalStatus(row.statusValue) ? (
                          row.hasApartment ? (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() =>
                                runAction(
                                  () => updateShortletReservationStatus(tenantSlug, row.id, "CHECKED_IN"),
                                  "Guest checked in.",
                                )
                              }
                              className="rc-btn rc-btn-primary rc-btn-sm"
                            >
                              Check in
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isPending || walkInUnitOptions.length === 0}
                              onClick={() => openAssignCheckIn(row)}
                              className="rc-btn rc-btn-primary rc-btn-sm"
                              title={
                                walkInUnitOptions.length === 0
                                  ? "No clean vacant apartments available"
                                  : undefined
                              }
                            >
                              Assign & check in
                            </button>
                          )
                        ) : (
                          <span className="nil">—</span>
                        )}
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
        <h2 className="rc-section-title">Today&apos;s departures</h2>
        <p className="rc-section-hint">Review folio and settle balance before checkout.</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--elevated)] shadow-sm">
          <table className="rc-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Apartment</th>
                <th>Check-out</th>
                <th>Balance</th>
                {canManage ? <th>Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {departures.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="nil">
                    No departures scheduled for today.
                  </td>
                </tr>
              ) : (
                departures.map((row) => (
                  <tr
                    key={row.id}
                    className={[
                      row.alertLevel === "overdue"
                        ? "bg-[var(--danger-wash)]"
                        : row.alertLevel === "due-soon"
                          ? "bg-[var(--warn-wash)]"
                          : "",
                    ].join(" ")}
                  >
                    <td className="font-medium">{row.guestName}</td>
                    <td>{row.unitName}</td>
                    <td>{row.checkOutLabel}</td>
                    <td>{row.balanceLabel}</td>
                    {canManage ? (
                      <td>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setCheckoutId(row.id)}
                          className="rc-btn rc-btn-primary rc-btn-sm"
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
        <ModalOverlay open={walkInOpen} onClose={() => !isPending && setWalkInOpen(false)} panelClassName={MODAL_PANEL_LG}>
          <h2 className="text-[1.125rem] font-semibold tracking-tight">Walk-in check-in</h2>
          <p className="mt-1 text-[13px] text-muted">
            Guest pays and checks in now into a clean vacant apartment.
          </p>
          {walkInUnitOptions.length === 0 ? (
            <p className="mt-4 rounded-lg border border-[var(--warn-line)] bg-[var(--warn-wash)] px-3 py-2 text-[13px]">
              No clean vacant apartments. Mark a room clean on the Room board, then try again.
            </p>
          ) : (
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.unitId) {
                  showSnackbar("Select a clean vacant apartment.", "error");
                  return;
                }
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
                  () => setWalkInOpen(false),
                );
              }}
            >
              <label className="block text-[12.5px] font-medium text-muted">
                Apartment
                <UiSelect
                  className="mt-1"
                  value={form.unitId}
                  onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
                  required
                >
                  {walkInUnitOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </UiSelect>
              </label>
              <input
                className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
                placeholder="Guest name"
                value={form.guestName}
                onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                required
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="date"
                  className="rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
                  value={form.checkIn}
                  onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.value }))}
                  required
                />
                <input
                  type="time"
                  className="rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
                  value={form.checkInTime}
                  onChange={(e) => setForm((f) => ({ ...f, checkInTime: e.target.value }))}
                  required
                />
                <input
                  type="date"
                  className="rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
                  value={form.checkOut}
                  onChange={(e) => setForm((f) => ({ ...f, checkOut: e.target.value }))}
                  required
                />
                <input
                  type="time"
                  className="rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
                  value={form.checkOutTime}
                  onChange={(e) => setForm((f) => ({ ...f, checkOutTime: e.target.value }))}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setWalkInOpen(false)}
                  disabled={isPending}
                  className="rc-btn rc-btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isPending || !form.unitId} className="rc-btn rc-btn-primary">
                  {isPending ? "Checking in…" : "Check in now"}
                </button>
              </div>
            </form>
          )}
        </ModalOverlay>
      ) : null}

      {assignCheckIn ? (
        <ModalOverlay
          open={Boolean(assignCheckIn)}
          onClose={() => !isPending && setAssignCheckIn(null)}
          panelClassName={MODAL_PANEL_LG}
        >
          <h2 className="text-[1.125rem] font-semibold tracking-tight">Assign & check in</h2>
          <p className="mt-1 text-[13px] text-muted">
            Pick a clean vacant apartment for <strong className="text-foreground">{assignCheckIn.guestName}</strong>,
            then check them in.
          </p>
          {walkInUnitOptions.length === 0 ? (
            <p className="mt-4 rounded-lg border border-[var(--warn-line)] bg-[var(--warn-wash)] px-3 py-2 text-[13px]">
              No clean vacant apartments available. Update the Room board first.
            </p>
          ) : (
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!assignUnitId) {
                  showSnackbar("Select an apartment.", "error");
                  return;
                }
                const reservationId = assignCheckIn.id;
                const unitId = assignUnitId;
                runAction(
                  async () => {
                    const assigned = await assignShortletReservationApartment(tenantSlug, {
                      reservationId,
                      unitId,
                    });
                    if (!assigned.ok) return assigned;
                    return updateShortletReservationStatus(tenantSlug, reservationId, "CHECKED_IN");
                  },
                  "Guest assigned and checked in.",
                  () => setAssignCheckIn(null),
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
                  {walkInUnitOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </UiSelect>
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setAssignCheckIn(null)}
                  className="rc-btn rc-btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isPending || !assignUnitId} className="rc-btn rc-btn-primary">
                  {isPending ? "Working…" : "Assign & check in"}
                </button>
              </div>
            </form>
          )}
        </ModalOverlay>
      ) : null}

      {checkoutId && checkoutFolio ? (
        <ModalOverlay
          open={Boolean(checkoutId)}
          onClose={() => setCheckoutId(null)}
          panelClassName={MODAL_PANEL_XL}
        >
          <h2 className="text-lg font-bold">Checkout settlement</h2>
          <p className="mt-1 text-sm text-muted">
            Review all folio charges and payments before releasing the room.
          </p>
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
