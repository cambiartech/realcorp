"use client";

import { useState, useTransition } from "react";
import { useSnackbar } from "@/components/snackbar";
import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_LG, MODAL_PANEL_MD, MODAL_PANEL_SM, MODAL_PANEL_XL, MODAL_PANEL_XS, MODAL_PANEL_2XL } from "@/lib/modal-panel";
import { UiSelect } from "@/components/ui-select";
import {
  createShortletReservation,
  createShortletUnit,
  recordShortletPayment,
  updateShortletReservationStatus,
} from "./actions";

type Props = {
  tenantSlug: string;
  defaultCurrency: string;
  currencies: string[];
  canManage: boolean;
  analytics: {
    totalUnits: number;
    occupiedUnits: number;
    activeReservations: number;
    totalRevenueLabel: string;
    monthRevenueLabel: string;
    outstandingLabel: string;
  };
  units: Array<{
    id: string;
    name: string;
    location: string;
    nightlyRateLabel: string;
    cleaningFeeLabel: string;
    status: string;
    linkedProjectUnitLabel: string | null;
    activeReservation: string;
  }>;
  reservations: Array<{
    id: string;
    unitId: string;
    unitName: string;
    guestName: string;
    stayLabel: string;
    nights: number;
    totalAmountLabel: string;
    paidAmountLabel: string;
    balanceLabel: string;
    status: string;
  }>;
  payments: Array<{
    id: string;
    guestName: string;
    amountLabel: string;
    paidAtLabel: string;
    method: string;
    reference: string;
  }>;
  unitOptions: Array<{ id: string; label: string }>;
  projectUnitOptions: Array<{ id: string; label: string }>;
  reservationOptions: Array<{ id: string; label: string }>;
};

export function ShortletsWorkspace({
  tenantSlug,
  defaultCurrency,
  currencies,
  canManage,
  analytics,
  units,
  reservations,
  payments,
  unitOptions,
  projectUnitOptions,
  reservationOptions,
}: Props) {
  const { showSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"overview" | "units" | "reservations" | "payments">("overview");
  const [openUnitModal, setOpenUnitModal] = useState(false);
  const [openReservationModal, setOpenReservationModal] = useState(false);
  const [openPaymentModal, setOpenPaymentModal] = useState(false);

  const [unitForm, setUnitForm] = useState({
    source: "CUSTOM" as "CUSTOM" | "PROJECT_UNIT",
    projectUnitId: projectUnitOptions[0]?.id || "",
    name: "",
    location: "",
    nightlyRate: "",
    cleaningFee: "",
    currency: defaultCurrency,
  });
  const [reservationForm, setReservationForm] = useState({
    unitId: unitOptions[0]?.id || "",
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    checkIn: "",
    checkInTime: "14:00",
    checkOut: "",
    checkOutTime: "12:00",
    notes: "",
    collectPaymentNow: false,
    paymentAmount: "",
    paymentPaidAt: "",
    paymentMethod: "Transfer",
    paymentReference: "",
    paymentNote: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    reservationId: reservationOptions[0]?.id || "",
    amount: "",
    paidAt: "",
    method: "Transfer",
    reference: "",
    note: "",
  });

  function withAction(run: () => Promise<{ ok: boolean; error?: string }>, onSuccess?: () => void) {
    startTransition(async () => {
      const res = await run();
      if (res.ok) {
        showSnackbar("Saved.", "success");
        onSuccess?.();
      } else {
        showSnackbar(res.error || "Could not save.", "error");
      }
    });
  }

  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Short Lets</h1>
          <p className="mt-1 text-sm text-muted">Manage units, reservations, manual payments, and performance.</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOpenUnitModal(true)}
              className="rounded-md border border-foreground/15 px-3 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
            >
              Add unit
            </button>
            <button
              type="button"
              onClick={() => setOpenReservationModal(true)}
              className="rounded-md border border-foreground/15 px-3 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
            >
              New reservation
            </button>
            <button
              type="button"
              onClick={() => setOpenPaymentModal(true)}
              className="rounded-md border border-foreground bg-foreground px-3 py-2 text-sm font-semibold text-background hover:opacity-90"
            >
              Record payment
            </button>
          </div>
        ) : null}
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card label="Units" value={String(analytics.totalUnits)} />
        <Card label="Occupied units" value={String(analytics.occupiedUnits)} />
        <Card label="Active reservations" value={String(analytics.activeReservations)} />
        <Card label="Revenue (all-time)" value={analytics.totalRevenueLabel} />
        <Card label="Revenue (this month)" value={analytics.monthRevenueLabel} />
        <Card label="Outstanding balance" value={analytics.outstandingLabel} />
      </section>

      <div className="mt-6 border-b border-foreground/10">
        <div className="flex gap-5">
          <TabButton active={tab === "overview"} label="Overview" onClick={() => setTab("overview")} />
          <TabButton active={tab === "units"} label={`Units (${units.length})`} onClick={() => setTab("units")} />
          <TabButton
            active={tab === "reservations"}
            label={`Reservations (${reservations.length})`}
            onClick={() => setTab("reservations")}
          />
          <TabButton active={tab === "payments"} label={`Payments (${payments.length})`} onClick={() => setTab("payments")} />
        </div>
      </div>

      {tab === "overview" ? (
        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          <InsightCard label="Occupancy">
            <p className="text-2xl font-bold text-foreground">
              {analytics.totalUnits > 0 ? Math.round((analytics.occupiedUnits / analytics.totalUnits) * 100) : 0}%
            </p>
            <p className="mt-1 text-xs text-muted">
              {analytics.occupiedUnits} occupied out of {analytics.totalUnits} units
            </p>
          </InsightCard>
          <InsightCard label="Reservations in flow">
            <p className="text-2xl font-bold text-foreground">{analytics.activeReservations}</p>
            <p className="mt-1 text-xs text-muted">Reserved or checked-in bookings</p>
          </InsightCard>
          <InsightCard label="Outstanding">
            <p className="text-2xl font-bold text-foreground">{analytics.outstandingLabel}</p>
            <p className="mt-1 text-xs text-muted">Unpaid reservation balances</p>
          </InsightCard>
        </section>
      ) : null}

      {tab === "units" ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-foreground">Units</h2>
          <div className="mt-2 overflow-x-auto rounded-lg border border-foreground/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Linked source</th><th className="px-3 py-2">Rate</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Active</th></tr>
              </thead>
              <tbody>
                {units.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-muted">No units yet. Use Add unit.</td></tr>
                ) : units.map((u) => (
                  <tr key={u.id} className="border-t border-foreground/10">
                    <td className="px-3 py-2">{u.name}<div className="text-xs text-muted">{u.location}</div></td>
                    <td className="px-3 py-2 text-xs text-muted">{u.linkedProjectUnitLabel || "Custom"}</td>
                    <td className="px-3 py-2">{u.nightlyRateLabel}<div className="text-xs text-muted">Cleaning: {u.cleaningFeeLabel}</div></td>
                    <td className="px-3 py-2">{u.status}</td>
                    <td className="px-3 py-2">{u.activeReservation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "reservations" ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-foreground">Reservations</h2>
          <div className="mt-2 space-y-2">
            {reservations.length === 0 ? (
              <p className="rounded-lg border border-foreground/10 px-3 py-6 text-sm text-muted">No reservations yet.</p>
            ) : reservations.map((r) => (
              <div key={r.id} className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{r.guestName} · {r.unitName}</p>
                  <p className="text-xs text-muted">{r.status}</p>
                </div>
                <p className="mt-1 text-xs text-muted">{r.stayLabel} · {r.nights} nights</p>
                <p className="mt-1 text-xs text-muted">Total {r.totalAmountLabel} · Paid {r.paidAmountLabel} · Balance {r.balanceLabel}</p>
                {canManage ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => withAction(() => updateShortletReservationStatus(tenantSlug, r.id, "CHECKED_IN"))} className="rounded border border-foreground/20 px-2 py-1 text-xs">Check in</button>
                    <button onClick={() => withAction(() => updateShortletReservationStatus(tenantSlug, r.id, "CHECKED_OUT"))} className="rounded border border-foreground/20 px-2 py-1 text-xs">Check out</button>
                    <button onClick={() => withAction(() => updateShortletReservationStatus(tenantSlug, r.id, "CANCELLED"))} className="rounded border border-foreground/20 px-2 py-1 text-xs">Cancel</button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "payments" ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-foreground">Payments</h2>
          <div className="mt-2 overflow-x-auto rounded-lg border border-foreground/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-3 py-2">Guest</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Method</th><th className="px-3 py-2">Reference</th></tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-muted">No payments yet.</td></tr>
                ) : payments.map((p) => (
                  <tr key={p.id} className="border-t border-foreground/10">
                    <td className="px-3 py-2">{p.guestName}</td>
                    <td className="px-3 py-2">{p.amountLabel}</td>
                    <td className="px-3 py-2">{p.paidAtLabel}</td>
                    <td className="px-3 py-2">{p.method}</td>
                    <td className="px-3 py-2">{p.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {openUnitModal ? (
        <Modal title="Add short let unit" onClose={() => setOpenUnitModal(false)}>
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              withAction(
                () =>
                  createShortletUnit(tenantSlug, {
                    source: unitForm.source,
                    projectUnitId: unitForm.projectUnitId,
                    name: unitForm.name,
                    location: unitForm.location,
                    nightlyRate: Number(unitForm.nightlyRate),
                    cleaningFee: unitForm.cleaningFee ? Number(unitForm.cleaningFee) : undefined,
                    currency: unitForm.currency,
                  }),
                () => setOpenUnitModal(false),
              );
            }}
          >
            <div className="mt-2">
              <label className="block text-xs text-muted">Source</label>
              <select
                className="mt-1 w-full border border-foreground/15 bg-field px-2 py-2 text-sm"
                value={unitForm.source}
                onChange={(e) => setUnitForm((s) => ({ ...s, source: e.target.value as "CUSTOM" | "PROJECT_UNIT" }))}
              >
                <option value="CUSTOM">Custom unit</option>
                <option value="PROJECT_UNIT">Link from Projects unit</option>
              </select>
            </div>
            {unitForm.source === "PROJECT_UNIT" ? (
              <div className="mt-2">
                <label className="block text-xs text-muted">Projects unit</label>
                <select
                  className="mt-1 w-full border border-foreground/15 bg-field px-2 py-2 text-sm"
                  value={unitForm.projectUnitId}
                  onChange={(e) => setUnitForm((s) => ({ ...s, projectUnitId: e.target.value }))}
                >
                  {projectUnitOptions.length === 0 ? (
                    <option value="">No available project units</option>
                  ) : (
                    projectUnitOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))
                  )}
                </select>
              </div>
            ) : null}
            <Input
              label="Unit name"
              value={unitForm.name}
              onChange={(v) => setUnitForm((s) => ({ ...s, name: v }))}
              disabled={unitForm.source === "PROJECT_UNIT"}
              placeholder={unitForm.source === "PROJECT_UNIT" ? "Auto from linked project unit" : ""}
            />
            <Input label="Location" value={unitForm.location} onChange={(v) => setUnitForm((s) => ({ ...s, location: v }))} />
            <Input label="Nightly rate" type="number" value={unitForm.nightlyRate} onChange={(v) => setUnitForm((s) => ({ ...s, nightlyRate: v }))} />
            <Input label="Cleaning fee" type="number" value={unitForm.cleaningFee} onChange={(v) => setUnitForm((s) => ({ ...s, cleaningFee: v }))} />
            <div>
              <label className="mb-1 block text-sm text-muted">Currency</label>
              <UiSelect
                value={unitForm.currency}
                onChange={(e) => setUnitForm((s) => ({ ...s, currency: e.target.value }))}
              >
                {(currencies.length > 0 ? currencies : [defaultCurrency]).map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </UiSelect>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setOpenUnitModal(false)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm">Cancel</button>
              <button disabled={isPending} className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background">{isPending ? "Saving..." : "Create unit"}</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {openReservationModal ? (
        <Modal title="Create reservation" onClose={() => setOpenReservationModal(false)}>
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              withAction(
                () =>
                  createShortletReservation(tenantSlug, {
                    ...reservationForm,
                    paymentAmount: reservationForm.paymentAmount ? Number(reservationForm.paymentAmount) : undefined,
                  }),
                () => setOpenReservationModal(false),
              );
            }}
          >
            <label className="mt-2 block text-xs text-muted">Unit</label>
            <select
              className="w-full border border-foreground/15 bg-field px-2 py-2 text-sm"
              value={reservationForm.unitId}
              onChange={(e) => setReservationForm((s) => ({ ...s, unitId: e.target.value }))}
            >
              {unitOptions.length === 0 ? (
                <option value="">No units available</option>
              ) : (
                unitOptions.map((u) => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))
              )}
            </select>
            {unitOptions.length === 0 ? (
              <p className="text-xs text-muted">Create a unit first before making a reservation.</p>
            ) : null}
            <Input label="Guest name" value={reservationForm.guestName} onChange={(v) => setReservationForm((s) => ({ ...s, guestName: v }))} />
            <Input label="Guest email" value={reservationForm.guestEmail} onChange={(v) => setReservationForm((s) => ({ ...s, guestEmail: v }))} />
            <Input label="Guest phone" value={reservationForm.guestPhone} onChange={(v) => setReservationForm((s) => ({ ...s, guestPhone: v }))} />
            <Input label="Check in" type="date" value={reservationForm.checkIn} onChange={(v) => setReservationForm((s) => ({ ...s, checkIn: v }))} />
            <Input
              label="Check in time"
              type="time"
              value={reservationForm.checkInTime}
              onChange={(v) => setReservationForm((s) => ({ ...s, checkInTime: v }))}
            />
            <Input label="Check out" type="date" value={reservationForm.checkOut} onChange={(v) => setReservationForm((s) => ({ ...s, checkOut: v }))} />
            <Input
              label="Check out time"
              type="time"
              value={reservationForm.checkOutTime}
              onChange={(v) => setReservationForm((s) => ({ ...s, checkOutTime: v }))}
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={reservationForm.collectPaymentNow}
                onChange={(e) => setReservationForm((s) => ({ ...s, collectPaymentNow: e.target.checked }))}
              />
              Record payment now
            </label>
            {reservationForm.collectPaymentNow ? (
              <div className="rounded-md border border-foreground/10 bg-foreground/[0.02] p-2">
                <Input
                  label="Amount received"
                  type="number"
                  value={reservationForm.paymentAmount}
                  onChange={(v) => setReservationForm((s) => ({ ...s, paymentAmount: v }))}
                />
                <Input
                  label="Paid at"
                  type="datetime-local"
                  value={reservationForm.paymentPaidAt}
                  onChange={(v) => setReservationForm((s) => ({ ...s, paymentPaidAt: v }))}
                />
                <Input
                  label="Method"
                  value={reservationForm.paymentMethod}
                  onChange={(v) => setReservationForm((s) => ({ ...s, paymentMethod: v }))}
                />
                <Input
                  label="Reference"
                  value={reservationForm.paymentReference}
                  onChange={(v) => setReservationForm((s) => ({ ...s, paymentReference: v }))}
                />
              </div>
            ) : null}
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setOpenReservationModal(false)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm">Cancel</button>
              <button
                disabled={isPending || unitOptions.length === 0 || !reservationForm.unitId}
                className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Saving..." : "Reserve unit"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {openPaymentModal ? (
        <Modal title="Record short let payment" onClose={() => setOpenPaymentModal(false)}>
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              withAction(() =>
                recordShortletPayment(tenantSlug, paymentForm.reservationId, {
                  amount: Number(paymentForm.amount),
                  paidAt: paymentForm.paidAt,
                  method: paymentForm.method,
                  reference: paymentForm.reference,
                  note: paymentForm.note,
                }),
                () => setOpenPaymentModal(false),
              );
            }}
          >
            <label className="mt-2 block text-xs text-muted">Reservation</label>
            <select
              className="w-full border border-foreground/15 bg-field px-2 py-2 text-sm"
              value={paymentForm.reservationId}
              onChange={(e) => setPaymentForm((s) => ({ ...s, reservationId: e.target.value }))}
            >
              {reservationOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            <Input label="Amount" type="number" value={paymentForm.amount} onChange={(v) => setPaymentForm((s) => ({ ...s, amount: v }))} />
            <Input label="Paid at" type="date" value={paymentForm.paidAt} onChange={(v) => setPaymentForm((s) => ({ ...s, paidAt: v }))} />
            <Input label="Method" value={paymentForm.method} onChange={(v) => setPaymentForm((s) => ({ ...s, method: v }))} />
            <Input label="Reference" value={paymentForm.reference} onChange={(v) => setPaymentForm((s) => ({ ...s, reference: v }))} />
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setOpenPaymentModal(false)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm">Cancel</button>
              <button disabled={isPending} className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background">{isPending ? "Saving..." : "Save payment"}</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </article>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="mt-2">
      <label className="block text-xs text-muted">{label}</label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-foreground/15 bg-field px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
      />
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={["relative py-2 text-sm font-medium", active ? "text-foreground" : "text-muted"].join(" ")}
    >
      {label}
      <span className={["absolute -bottom-px left-0 h-0.5 w-full", active ? "bg-foreground" : "bg-transparent"].join(" ")} />
    </button>
  );
}

function InsightCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <article className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-2">{children}</div>
    </article>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <ModalOverlay open onClose={onClose} panelClassName={MODAL_PANEL_MD}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06]"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="mt-4">{children}</div>
    </ModalOverlay>
  );
}
