"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import {
  createShortletBookings,
  createShortletReservation,
  listAvailableShortletApartments,
} from "../../actions";

type GuestOption = {
  id: string;
  label: string;
  email: string | null;
  phone: string | null;
};

type LocationOption = { id: string; label: string };

type ApartmentOption = {
  id: string;
  label: string;
  propertyId: string | null;
  nightlyRate: number;
  cleaningFee: number;
  serviceCharge: number;
  cautionFee: number | null;
  currency: string;
};

type StayBlock = {
  key: string;
  checkIn: string;
  checkInTime: string;
  checkOut: string;
  checkOutTime: string;
  propertyId: string;
  unitId: string;
  available: ApartmentOption[];
  loading: boolean;
};

type Props = {
  tenantSlug: string;
  defaultCheckInTime: string;
  defaultCheckOutTime: string;
  defaultCurrency: string;
  guests: GuestOption[];
  locationOptions: LocationOption[];
  prefillGuestId?: string;
  prefillCheckIn?: string;
  prefillCheckOut?: string;
};

const PAYMENT_METHODS = ["Cash", "Transfer", "Card", "POS", "Online"];

function newStayBlock(defaults: {
  checkInTime: string;
  checkOutTime: string;
  checkIn?: string;
  checkOut?: string;
  propertyId?: string;
}): StayBlock {
  return {
    key: Math.random().toString(36).slice(2),
    checkIn: defaults.checkIn || "",
    checkInTime: defaults.checkInTime,
    checkOut: defaults.checkOut || "",
    checkOutTime: defaults.checkOutTime,
    propertyId: defaults.propertyId || "",
    unitId: "",
    available: [],
    loading: false,
  };
}

function nightsBetween(checkIn: string, checkInTime: string, checkOut: string, checkOutTime: string) {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(`${checkIn}T${checkInTime}:00`);
  const end = new Date(`${checkOut}T${checkOutTime}:00`);
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export function NewBookingWorkspace({
  tenantSlug,
  defaultCheckInTime,
  defaultCheckOutTime,
  defaultCurrency,
  guests,
  locationOptions,
  prefillGuestId,
  prefillCheckIn,
  prefillCheckOut,
}: Props) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();

  const [bookingType, setBookingType] = useState<"PRIOR" | "WALK_IN">("PRIOR");
  const [apartmentMode, setApartmentMode] = useState<"SINGLE" | "MULTIPLE">("SINGLE");
  const [guestId, setGuestId] = useState(prefillGuestId || "");
  const [guestSearch, setGuestSearch] = useState("");
  const [guestCount, setGuestCount] = useState("1");
  const [notes, setNotes] = useState("");
  const [checkInImmediately, setCheckInImmediately] = useState(false);

  const [stays, setStays] = useState<StayBlock[]>(() => [
    newStayBlock({
      checkInTime: defaultCheckInTime,
      checkOutTime: defaultCheckOutTime,
      checkIn: prefillCheckIn,
      checkOut: prefillCheckOut,
      propertyId: locationOptions[0]?.id,
    }),
  ]);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [cautionFeePaid, setCautionFeePaid] = useState("");
  const [paymentPaidAt, setPaymentPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("Transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [collectPayment, setCollectPayment] = useState(false);

  const isWalkIn = bookingType === "WALK_IN" || checkInImmediately;

  const filteredGuests = useMemo(() => {
    const q = guestSearch.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) => g.label.toLowerCase().includes(q) || g.email?.toLowerCase().includes(q) || g.phone?.includes(q),
    );
  }, [guests, guestSearch]);

  const selectedGuest = guests.find((g) => g.id === guestId);

  useEffect(() => {
    if (prefillGuestId) setGuestId(prefillGuestId);
  }, [prefillGuestId]);

  function updateStay(index: number, patch: Partial<StayBlock>) {
    setStays((prev) => {
      const next = prev.map((s, i) => (i === index ? { ...s, ...patch } : s));
      const updated = next[index];
      if (
        updated &&
        (patch.checkIn ||
          patch.checkOut ||
          patch.checkInTime ||
          patch.checkOutTime ||
          patch.propertyId !== undefined)
      ) {
        void loadAvailability(index, updated);
      }
      return next;
    });
  }

  async function loadAvailability(index: number, stay: StayBlock) {
    if (!stay.checkIn || !stay.checkOut) return;
    setStays((prev) => prev.map((s, i) => (i === index ? { ...s, loading: true } : s)));
    const res = await listAvailableShortletApartments(tenantSlug, {
      checkIn: stay.checkIn,
      checkInTime: stay.checkInTime,
      checkOut: stay.checkOut,
      checkOutTime: stay.checkOutTime,
      propertyId: stay.propertyId || undefined,
      walkInOnly: isWalkIn,
    });
    setStays((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        if (!res.ok) return { ...s, loading: false, available: [] };
        const unitId =
          s.unitId && res.apartments.some((a: ApartmentOption) => a.id === s.unitId) ? s.unitId : "";
        return { ...s, loading: false, available: res.apartments, unitId };
      }),
    );
  }

  useEffect(() => {
    stays.forEach((stay, index) => {
      if (stay.checkIn && stay.checkOut && stay.available.length === 0 && !stay.loading) {
        void loadAvailability(index, stay);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWalkIn]);

  const pricing = useMemo(() => {
    let subtotal = 0;
    let cautionTotal = 0;
    let currency = defaultCurrency;
    for (const stay of stays) {
      const apt = stay.available.find((a) => a.id === stay.unitId);
      if (!apt) continue;
      const nights = nightsBetween(stay.checkIn, stay.checkInTime, stay.checkOut, stay.checkOutTime);
      subtotal += apt.nightlyRate * nights + apt.cleaningFee + (apt.serviceCharge || 0);
      cautionTotal += apt.cautionFee || 0;
      currency = apt.currency;
    }
    return { subtotal, cautionTotal, currency, total: subtotal };
  }, [stays, defaultCurrency]);

  function addStay() {
    const first = stays[0];
    setStays((prev) => [
      ...prev,
      newStayBlock({
        checkInTime: defaultCheckInTime,
        checkOutTime: defaultCheckOutTime,
        checkIn: first?.checkIn,
        checkOut: first?.checkOut,
        propertyId: first?.propertyId || locationOptions[0]?.id,
      }),
    ]);
  }

  function removeStay(index: number) {
    if (stays.length <= 1) return;
    setStays((prev) => prev.filter((_, i) => i !== index));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestId) {
      showSnackbar("Select a guest or create a new one first.", "error");
      return;
    }

    startTransition(async () => {
      const payload = {
        guestId,
        guestCount: Number(guestCount) || 1,
        isWalkIn: bookingType === "WALK_IN",
        checkInImmediately: checkInImmediately || bookingType === "WALK_IN",
        notes: notes || undefined,
        collectPaymentNow: collectPayment,
        paymentAmount: collectPayment ? Number(paymentAmount || 0) : undefined,
        cautionFeePaid: collectPayment ? Number(cautionFeePaid || 0) : undefined,
        paymentPaidAt: collectPayment ? paymentPaidAt : undefined,
        paymentMethod,
        paymentReference: paymentReference || undefined,
        stays: stays.map((s) => ({
          unitId: s.unitId || undefined,
          propertyId: s.propertyId || undefined,
          checkIn: s.checkIn,
          checkInTime: s.checkInTime,
          checkOut: s.checkOut,
          checkOutTime: s.checkOutTime,
        })),
      };

      const res =
        stays.length === 1 && apartmentMode === "SINGLE"
          ? await createShortletReservation(tenantSlug, {
              guestId,
              guestCount: Number(guestCount) || 1,
              unitId: stays[0].unitId || undefined,
              propertyId: stays[0].propertyId || undefined,
              checkIn: stays[0].checkIn,
              checkInTime: stays[0].checkInTime,
              checkOut: stays[0].checkOut,
              checkOutTime: stays[0].checkOutTime,
              notes: notes || undefined,
              isWalkIn: bookingType === "WALK_IN",
              checkInImmediately: checkInImmediately || bookingType === "WALK_IN",
              collectPaymentNow: collectPayment,
              paymentAmount: collectPayment ? Number(paymentAmount || 0) : undefined,
              cautionFeePaid: collectPayment ? Number(cautionFeePaid || 0) : undefined,
              paymentPaidAt: collectPayment ? paymentPaidAt : undefined,
              paymentMethod,
              paymentReference: paymentReference || undefined,
            })
          : await createShortletBookings(tenantSlug, payload);

      if (!res.ok) {
        showSnackbar(res.error || "Could not create booking.", "error");
        return;
      }
      showSnackbar(bookingType === "WALK_IN" ? "Walk-in checked in." : "Booking created.", "success");
      router.push(`/${tenantSlug}/shortlets/reservations`);
      router.refresh();
    });
  }

  const returnTo = `/${tenantSlug}/shortlets/reservations/new`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${tenantSlug}/shortlets/reservations`}
          className="text-sm text-muted hover:text-foreground"
        >
          ← Back to reservations
        </Link>
        <h2 className="mt-2 text-xl font-bold">New booking</h2>
        <p className="mt-1 text-sm text-muted">
          Create an advance reservation or walk-in check-in. Pick a guest profile — apartment optional until
          check-in.
        </p>
      </div>

      <form className="grid gap-6 xl:grid-cols-3 xl:items-start" onSubmit={submit}>
        <div className="space-y-6 xl:col-span-2">
          <section className="rounded-lg border border-foreground/10 p-4">
            <h3 className="font-semibold">Booking type</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TypeCard
                active={bookingType === "PRIOR"}
                title="Prior booking"
                subtitle="Advance reservation"
                onClick={() => setBookingType("PRIOR")}
              />
              <TypeCard
                active={bookingType === "WALK_IN"}
                title="Walk-in guest"
                subtitle="Immediate check-in"
                onClick={() => setBookingType("WALK_IN")}
              />
            </div>
            {bookingType === "WALK_IN" ? (
              <p className="mt-3 rounded-md border border-[var(--warn-line)] bg-[var(--warn-wash)] px-3 py-2 text-sm text-[var(--warn)]">
                Walk-in policy: guest must pay the full booking amount before check-in. A clean vacant
                apartment is required.
              </p>
            ) : null}
          </section>

          <section className="rounded-lg border border-foreground/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="font-semibold">Guest information</h3>
              <Link
                href={`/${tenantSlug}/shortlets/guests/new?returnTo=${encodeURIComponent(returnTo)}`}
                className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm font-medium hover:bg-foreground/[0.03]"
              >
                + New guest
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              <input
                type="search"
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Search guests by name, email, or phone…"
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
              />
              <label className="block text-sm text-muted">
                Select guest *
                <UiSelect
                  className="mt-1"
                  value={guestId}
                  onChange={(e) => setGuestId(e.target.value)}
                  required
                >
                  <option value="">Choose a guest…</option>
                  {filteredGuests.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                      {g.email ? ` · ${g.email}` : ""}
                    </option>
                  ))}
                </UiSelect>
              </label>
              {selectedGuest ? (
                <div className="rounded-md bg-foreground/[0.03] px-3 py-2 text-sm text-muted">
                  {selectedGuest.email ? <div>{selectedGuest.email}</div> : null}
                  {selectedGuest.phone ? <div>{selectedGuest.phone}</div> : null}
                </div>
              ) : null}
              <label className="block text-sm text-muted sm:max-w-xs">
                Number of guests
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-foreground/10 p-4">
            <h3 className="font-semibold">Apartment selection</h3>
            <div className="mt-3 flex gap-1 rounded-md border border-foreground/10 p-1">
              <button
                type="button"
                onClick={() => {
                  setApartmentMode("SINGLE");
                  setStays((s) => s.slice(0, 1));
                }}
                className={
                  apartmentMode === "SINGLE"
                    ? "flex-1 rounded bg-foreground px-3 py-1.5 text-sm text-background"
                    : "flex-1 rounded px-3 py-1.5 text-sm text-muted"
                }
              >
                Single apartment
              </button>
              <button
                type="button"
                onClick={() => setApartmentMode("MULTIPLE")}
                className={
                  apartmentMode === "MULTIPLE"
                    ? "flex-1 rounded bg-foreground px-3 py-1.5 text-sm text-background"
                    : "flex-1 rounded px-3 py-1.5 text-sm text-muted"
                }
              >
                Multiple apartments
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {stays.map((stay, index) => (
                <div key={stay.key} className="rounded-md border border-foreground/10 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Apartment {index + 1}</p>
                    {apartmentMode === "MULTIPLE" && stays.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeStay(index)}
                        className="text-xs text-[var(--danger)]"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input
                      type="date"
                      className="rounded-md border px-3 py-2 text-sm"
                      value={stay.checkIn}
                      onChange={(e) => updateStay(index, { checkIn: e.target.value })}
                      required
                    />
                    <input
                      type="time"
                      className="rounded-md border px-3 py-2 text-sm"
                      value={stay.checkInTime}
                      onChange={(e) => updateStay(index, { checkInTime: e.target.value })}
                      required
                    />
                    <input
                      type="date"
                      className="rounded-md border px-3 py-2 text-sm"
                      value={stay.checkOut}
                      onChange={(e) => updateStay(index, { checkOut: e.target.value })}
                      required
                    />
                    <input
                      type="time"
                      className="rounded-md border px-3 py-2 text-sm"
                      value={stay.checkOutTime}
                      onChange={(e) => updateStay(index, { checkOutTime: e.target.value })}
                      required
                    />
                  </div>
                  {locationOptions.length > 0 ? (
                    <label className="mt-3 block text-sm text-muted">
                      Location
                      <UiSelect
                        className="mt-1"
                        value={stay.propertyId}
                        onChange={(e) => updateStay(index, { propertyId: e.target.value, unitId: "" })}
                      >
                        <option value="">All locations</option>
                        {locationOptions.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.label}
                          </option>
                        ))}
                      </UiSelect>
                    </label>
                  ) : null}
                  {!stay.checkIn || !stay.checkOut ? (
                    <p className="mt-3 text-sm text-muted">
                      Select check-in and check-out dates to see available apartments.
                    </p>
                  ) : stay.loading ? (
                    <p className="mt-3 text-sm text-muted">Loading available apartments…</p>
                  ) : (
                    <label className="mt-3 block text-sm text-muted">
                      Apartment <span className="text-xs">(optional — assign at check-in)</span>
                      <UiSelect
                        className="mt-1"
                        value={stay.unitId}
                        onChange={(e) => updateStay(index, { unitId: e.target.value })}
                      >
                        <option value="">Assign later</option>
                        {stay.available.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label} — {a.currency} {a.nightlyRate.toLocaleString()}/night
                          </option>
                        ))}
                      </UiSelect>
                    </label>
                  )}
                  {stay.checkIn &&
                  stay.checkOut &&
                  !stay.loading &&
                  stay.available.length === 0 &&
                  isWalkIn ? (
                    <p className="mt-2 text-sm text-[var(--warn)]">
                      No clean vacant apartments for these dates.
                    </p>
                  ) : null}
                </div>
              ))}
              {apartmentMode === "MULTIPLE" ? (
                <button
                  type="button"
                  onClick={addStay}
                  className="w-full rounded-md border border-dashed border-foreground/20 px-3 py-2 text-sm text-muted hover:border-foreground/40"
                >
                  + Add another apartment
                </button>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-foreground/10 p-4">
            <h3 className="font-semibold">Notes</h3>
            <textarea
              className="mt-3 w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
              placeholder="Special requests or internal notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-2rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain">
          <section className="rounded-lg border border-foreground/10 p-4">
            <h3 className="font-semibold">Pricing</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Room charges</dt>
                <dd>
                  {pricing.currency} {pricing.subtotal.toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Caution fee</dt>
                <dd>
                  {pricing.currency} {pricing.cautionTotal.toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between border-t border-foreground/10 pt-2 font-semibold">
                <dt>Total</dt>
                <dd>
                  {pricing.currency} {pricing.total.toLocaleString()}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-foreground/10 p-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={collectPayment}
                onChange={(e) => setCollectPayment(e.target.checked)}
              />
              Record payment now
            </label>
            {collectPayment ? (
              <div className="mt-3 space-y-3">
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Booking amount paid"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Caution fee paid"
                  value={cautionFeePaid}
                  onChange={(e) => setCautionFeePaid(e.target.value)}
                />
                <input
                  type="date"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={paymentPaidAt}
                  onChange={(e) => setPaymentPaidAt(e.target.value)}
                />
                <label className="block text-sm text-muted">
                  Payment method
                  <UiSelect
                    className="mt-1"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </UiSelect>
                </label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Reference (optional)"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>
            ) : null}
          </section>

          {bookingType === "PRIOR" ? (
            <label className="flex items-center gap-2 rounded-lg border border-foreground/10 p-4 text-sm">
              <input
                type="checkbox"
                checked={checkInImmediately}
                onChange={(e) => setCheckInImmediately(e.target.checked)}
              />
              Check in immediately after booking
            </label>
          ) : null}

          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={isPending || !guestId}
              className="rounded-md bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
            >
              {bookingType === "WALK_IN" ? "Check in guest" : "Create booking"}
            </button>
            <Link
              href={`/${tenantSlug}/shortlets/reservations`}
              className="text-center text-sm text-muted hover:text-foreground"
            >
              Cancel
            </Link>
          </div>
        </aside>
      </form>
    </div>
  );
}

function TypeCard({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg border p-4 text-left transition-colors",
        active ? "border-foreground bg-foreground/[0.04]" : "border-foreground/10 hover:border-foreground/25",
      ].join(" ")}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted">{subtitle}</p>
    </button>
  );
}
