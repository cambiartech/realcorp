"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSnackbar } from "@/components/snackbar";
import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_LG } from "@/lib/modal-panel";
import { UiSelect } from "@/components/ui-select";
import { createShortletUnit, saveShortletUnit } from "../actions";

const AMENITIES = [
  "WiFi",
  "AC",
  "Parking",
  "TV",
  "Kitchen",
  "Pool",
  "Generator",
  "Security",
  "Laundry",
  "Balcony",
];

type ApartmentRow = {
  id: string;
  name: string;
  locationName: string;
  floor: string;
  roomLayout: string;
  nightlyRateLabel: string;
  listingStatus: string;
  listingStatusValue: string;
  housekeepingStatus: string;
  isActive: boolean;
  linkedProjectUnit: string | null;
  nightlyRate: number;
  cleaningFee: number | null;
  serviceCharge: number | null;
  cautionFee: number | null;
  currency: string;
  sizeSqFt: number | null;
  maxOccupancy: number | null;
  description: string;
  amenities: string[];
  propertyId: string;
};

type LocationOption = { id: string; label: string };

type Props = {
  tenantSlug: string;
  defaultCurrency: string;
  currencies: string[];
  apartments: ApartmentRow[];
  locationOptions: LocationOption[];
  projectUnitOptions: Array<{ id: string; label: string }>;
  defaultServiceCharge?: number | null;
  initialLocationId?: string;
};

type FormState = {
  source: "CUSTOM" | "PROJECT_UNIT";
  projectUnitId: string;
  propertyId: string;
  name: string;
  floor: string;
  roomLayout: string;
  sizeSqFt: string;
  maxOccupancy: string;
  description: string;
  amenities: string[];
  listingStatus: "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE";
  isActive: boolean;
  nightlyRate: string;
  cleaningFee: string;
  serviceCharge: string;
  cautionFee: string;
  currency: string;
};

function emptyForm(defaultCurrency: string, locationId: string): FormState {
  return {
    source: "CUSTOM",
    projectUnitId: "",
    propertyId: locationId,
    name: "",
    floor: "",
    roomLayout: "",
    sizeSqFt: "",
    maxOccupancy: "",
    description: "",
    amenities: [],
    listingStatus: "AVAILABLE",
    isActive: true,
    nightlyRate: "",
    cleaningFee: "",
    serviceCharge: "",
    cautionFee: "",
    currency: defaultCurrency,
  };
}

function rowToForm(row: ApartmentRow): FormState {
  return {
    source: "CUSTOM",
    projectUnitId: "",
    propertyId: row.propertyId,
    name: row.name,
    floor: row.floor,
    roomLayout: row.roomLayout,
    sizeSqFt: row.sizeSqFt != null ? String(row.sizeSqFt) : "",
    maxOccupancy: row.maxOccupancy != null ? String(row.maxOccupancy) : "",
    description: row.description,
    amenities: row.amenities,
    listingStatus: row.listingStatusValue as FormState["listingStatus"],
    isActive: row.isActive,
    nightlyRate: String(row.nightlyRate),
    cleaningFee: row.cleaningFee != null ? String(row.cleaningFee) : "",
    serviceCharge: row.serviceCharge != null ? String(row.serviceCharge) : "",
    cautionFee: row.cautionFee != null ? String(row.cautionFee) : "",
    currency: row.currency,
  };
}

export function ApartmentsWorkspace({
  tenantSlug,
  defaultCurrency,
  currencies,
  apartments,
  locationOptions,
  projectUnitOptions,
  defaultServiceCharge,
  initialLocationId = "",
}: Props) {
  const { showSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [locationFilter, setLocationFilter] = useState(initialLocationId);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  /** 1 = Place, 2 = Money, 3 = Details — progressive staged create (edit shows all). */
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(defaultCurrency, initialLocationId || locationOptions[0]?.id || ""),
  );

  const filteredApartments = useMemo(() => {
    if (!locationFilter) return apartments;
    return apartments.filter((a) => a.propertyId === locationFilter);
  }, [apartments, locationFilter]);

  function setLocationQuery(next: string) {
    setLocationFilter(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("location", next);
    else params.delete("location");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg = "Saved.", onOk?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        showSnackbar(msg, "success");
        onOk?.();
      } else {
        showSnackbar(res.error || "Could not save.", "error");
      }
    });
  }

  function toggleAmenity(name: string) {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(name) ? f.amenities.filter((a) => a !== name) : [...f.amenities, name],
    }));
  }

  function openCreate() {
    setEditId(null);
    setCreateStep(1);
    setForm(emptyForm(defaultCurrency, locationFilter || locationOptions[0]?.id || ""));
    setOpen(true);
  }

  function openEdit(row: ApartmentRow) {
    setEditId(row.id);
    setCreateStep(1);
    setForm(rowToForm(row));
    setOpen(true);
  }

  function validateCreateStep(step: 1 | 2 | 3): string | null {
    if (step === 1) {
      if (!form.propertyId) return "Choose a location.";
      if (form.source === "PROJECT_UNIT") {
        if (!form.projectUnitId) return "Choose a project unit.";
      } else if (!form.name.trim()) {
        return "Enter an apartment name.";
      }
    }
    if (step === 2) {
      if (!form.nightlyRate || Number(form.nightlyRate) < 0) return "Enter a nightly rate.";
    }
    return null;
  }

  const payloadBase = {
    propertyId: form.propertyId || undefined,
    floor: form.floor || undefined,
    roomLayout: form.roomLayout || undefined,
    sizeSqFt: form.sizeSqFt ? Number(form.sizeSqFt) : undefined,
    maxOccupancy: form.maxOccupancy ? Number(form.maxOccupancy) : undefined,
    description: form.description || undefined,
    amenities: form.amenities,
    listingStatus: form.listingStatus,
    isActive: form.isActive,
    nightlyRate: Number(form.nightlyRate),
    cleaningFee: form.cleaningFee ? Number(form.cleaningFee) : undefined,
    serviceCharge: form.serviceCharge ? Number(form.serviceCharge) : undefined,
    cautionFee: form.cautionFee ? Number(form.cautionFee) : undefined,
    currency: form.currency,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Apartments</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Short-let inventory — standalone or linked to a sales project unit as a last resort. Not every
            project unit is an apartment.
          </p>
          {locationOptions.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--warn)]">
              <Link href={`/${tenantSlug}/shortlets/locations`} className="underline">
                Add a location
              </Link>{" "}
              first, then create apartments here.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setLocationQuery("")}
                className={[
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  !locationFilter
                    ? "bg-foreground text-background"
                    : "border border-foreground/15 text-foreground",
                ].join(" ")}
              >
                All ({apartments.length})
              </button>
              {locationOptions.map((loc) => {
                const count = apartments.filter((a) => a.propertyId === loc.id).length;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setLocationQuery(loc.id)}
                    className={[
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      locationFilter === loc.id
                        ? "bg-foreground text-background"
                        : "border border-foreground/15 text-foreground",
                    ].join(" ")}
                  >
                    {loc.label} ({count})
                  </button>
                );
              })}
              {locationFilter ? (
                <Link
                  href={`/${tenantSlug}/shortlets/locations/${locationFilter}`}
                  className="text-xs font-semibold underline underline-offset-2"
                >
                  Open location board →
                </Link>
              ) : null}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={locationOptions.length === 0}
          className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
        >
          Add apartment
        </button>
      </div>

      {filteredApartments.length === 0 ? (
        <div className="rounded-lg border border-foreground/10 p-8 text-center">
          <p className="font-medium">
            {locationFilter ? "No apartments at this location" : "No apartments yet"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {locationFilter
              ? "Add units for this site, or switch to All."
              : "Create custom apartments for short-let-only tenants — no Projects module required."}
          </p>
          {locationOptions.length > 0 ? (
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              Add apartment
            </button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-foreground/10">
          <table className="min-w-full text-sm">
            <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Apartment</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Layout</th>
                <th className="px-4 py-3">Rate / night</th>
                <th className="px-4 py-3">Listing</th>
                <th className="px-4 py-3">Room board</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApartments.map((a) => (
                <tr key={a.id} className="border-t border-foreground/10">
                  <td className="px-4 py-3">
                    <div className="font-medium">{a.name}</div>
                    {a.linkedProjectUnit ? (
                      <div className="text-xs text-muted">Linked: {a.linkedProjectUnit}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{a.locationName || "—"}</td>
                  <td className="px-4 py-3">{a.roomLayout || "—"}</td>
                  <td className="px-4 py-3">{a.nightlyRateLabel}</td>
                  <td className="px-4 py-3">{a.listingStatus}</td>
                  <td className="px-4 py-3">{a.housekeepingStatus}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => openEdit(a)}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <ModalOverlay open={open} onClose={() => setOpen(false)} panelClassName={MODAL_PANEL_LG}>
          <h2 className="text-lg font-bold">{editId ? "Edit apartment" : "Add apartment"}</h2>
          {!editId ? (
            <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Create progress">
              {(
                [
                  [1, "Place"],
                  [2, "Money"],
                  [3, "Details"],
                ] as const
              ).map(([n, label]) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    if (n < createStep) setCreateStep(n);
                  }}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    createStep === n
                      ? "bg-foreground text-background"
                      : createStep > n
                        ? "border border-foreground/30 text-foreground"
                        : "border border-foreground/10 text-muted",
                  ].join(" ")}
                >
                  {n}. {label}
                </button>
              ))}
              <span className="text-xs text-muted">Step {createStep} of 3</span>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted">Update rates, layout, and listing status.</p>
          )}

          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editId && createStep < 3) {
                const err = validateCreateStep(createStep);
                if (err) {
                  showSnackbar(err, "error");
                  return;
                }
                setCreateStep((s) => (s === 1 ? 2 : 3));
                return;
              }
              if (!editId) {
                const err = validateCreateStep(3) || validateCreateStep(2) || validateCreateStep(1);
                if (err) {
                  showSnackbar(err, "error");
                  return;
                }
              }
              if (editId) {
                run(
                  () =>
                    saveShortletUnit(tenantSlug, {
                      id: editId,
                      name: form.name,
                      ...payloadBase,
                    }),
                  "Apartment updated.",
                  () => setOpen(false),
                );
              } else {
                run(
                  () =>
                    createShortletUnit(tenantSlug, {
                      source: form.source,
                      projectUnitId: form.source === "PROJECT_UNIT" ? form.projectUnitId : undefined,
                      name: form.name,
                      ...payloadBase,
                    }),
                  "Apartment created.",
                  () => setOpen(false),
                );
              }
            }}
          >
            {(editId || createStep === 1) && (
              <section className="space-y-3">
                {!editId ? (
                  <p className="text-sm text-muted">Which location, and what should guests call this unit?</p>
                ) : null}
                {!editId && projectUnitOptions.length > 0 ? (
                  <details className="rounded-md border border-foreground/10 p-3 text-sm">
                    <summary className="cursor-pointer font-medium text-muted">
                      Advanced: import from sales project unit
                    </summary>
                    <label className="mt-3 block text-sm text-muted">
                      Source
                      <UiSelect
                        className="mt-1"
                        value={form.source}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, source: e.target.value as FormState["source"] }))
                        }
                      >
                        <option value="CUSTOM">Custom apartment (recommended)</option>
                        <option value="PROJECT_UNIT">Import from project unit</option>
                      </UiSelect>
                    </label>
                    {form.source === "PROJECT_UNIT" ? (
                      <label className="mt-3 block text-sm text-muted">
                        Project unit
                        <UiSelect
                          className="mt-1"
                          value={form.projectUnitId}
                          onChange={(e) => setForm((f) => ({ ...f, projectUnitId: e.target.value }))}
                          required={createStep === 1}
                        >
                          <option value="">Select unit…</option>
                          {projectUnitOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </UiSelect>
                      </label>
                    ) : null}
                  </details>
                ) : null}

                <label className="block text-sm text-muted">
                  Location
                  <UiSelect
                    className="mt-1"
                    value={form.propertyId}
                    onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}
                    required
                  >
                    <option value="">Select location…</option>
                    {locationOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </UiSelect>
                </label>

                {form.source !== "PROJECT_UNIT" ? (
                  <label className="block text-sm text-muted">
                    Apartment name
                    <input
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required={createStep === 1 || Boolean(editId)}
                      placeholder="e.g. Room 12"
                    />
                  </label>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm text-muted">
                    Floor
                    <input
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      placeholder="e.g. 2nd Floor"
                      value={form.floor}
                      onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
                    />
                  </label>
                  <label className="block text-sm text-muted">
                    Rooms / layout
                    <input
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      placeholder="e.g. Studio, 2 Bed"
                      value={form.roomLayout}
                      onChange={(e) => setForm((f) => ({ ...f, roomLayout: e.target.value }))}
                    />
                  </label>
                </div>
              </section>
            )}

            {(editId || createStep === 2) && (
              <section className="space-y-3">
                {!editId ? (
                  <p className="text-sm text-muted">What the guest pays — keep fees clear for the folio.</p>
                ) : null}
                <label className="block text-sm text-muted">
                  Rate per night
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={form.nightlyRate}
                    onChange={(e) => setForm((f) => ({ ...f, nightlyRate: e.target.value }))}
                    required={createStep === 2 || Boolean(editId)}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm text-muted">
                    Cleaning fee
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      placeholder="Once per stay"
                      value={form.cleaningFee}
                      onChange={(e) => setForm((f) => ({ ...f, cleaningFee: e.target.value }))}
                    />
                  </label>
                  <label className="block text-sm text-muted">
                    Caution fee
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      placeholder="Refundable"
                      value={form.cautionFee}
                      onChange={(e) => setForm((f) => ({ ...f, cautionFee: e.target.value }))}
                    />
                  </label>
                </div>
                <label className="block text-sm text-muted">
                  Service charge
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    placeholder={
                      defaultServiceCharge != null
                        ? `Org default ${defaultServiceCharge.toLocaleString()}`
                        : "Once per stay, or blank"
                    }
                    value={form.serviceCharge}
                    onChange={(e) => setForm((f) => ({ ...f, serviceCharge: e.target.value }))}
                  />
                  <span className="mt-1 block text-xs text-muted">
                    Estate / org fee once per stay. Blank uses Short-lets → Settings default
                    {defaultServiceCharge != null
                      ? ` (${form.currency} ${defaultServiceCharge.toLocaleString()})`
                      : ""}
                    .
                  </span>
                </label>
                <label className="block text-sm text-muted">
                  Currency
                  <UiSelect
                    className="mt-1"
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  >
                    {currencies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </UiSelect>
                </label>
              </section>
            )}

            {(editId || createStep === 3) && (
              <section className="space-y-3">
                {!editId ? (
                  <p className="text-sm text-muted">Optional listing details — you can finish later.</p>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm text-muted">
                    Size (sq ft)
                    <input
                      type="number"
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      value={form.sizeSqFt}
                      onChange={(e) => setForm((f) => ({ ...f, sizeSqFt: e.target.value }))}
                    />
                  </label>
                  <label className="block text-sm text-muted">
                    Max occupancy
                    <input
                      type="number"
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      value={form.maxOccupancy}
                      onChange={(e) => setForm((f) => ({ ...f, maxOccupancy: e.target.value }))}
                    />
                  </label>
                </div>
                <label className="block text-sm text-muted">
                  Description
                  <textarea
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Optional notes"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </label>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Amenities</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {AMENITIES.map((a) => (
                      <label key={a} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.amenities.includes(a)}
                          onChange={() => toggleAmenity(a)}
                        />
                        {a}
                      </label>
                    ))}
                  </div>
                </div>
                <label className="block text-sm text-muted">
                  Listing status
                  <UiSelect
                    className="mt-1"
                    value={form.listingStatus}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        listingStatus: e.target.value as FormState["listingStatus"],
                      }))
                    }
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="UNAVAILABLE">Unavailable</option>
                    <option value="MAINTENANCE">Maintenance</option>
                  </UiSelect>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  Active listing
                </label>
              </section>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-foreground/10 pt-4">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-3 py-2 text-sm">
                Cancel
              </button>
              <div className="flex flex-wrap gap-2">
                {!editId && createStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setCreateStep((s) => (s === 3 ? 2 : 1))}
                    className="rounded-md border px-3 py-2 text-sm font-semibold"
                  >
                    Back
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background disabled:opacity-50"
                >
                  {editId
                    ? "Update apartment"
                    : createStep < 3
                      ? createStep === 1
                        ? "Continue to money"
                        : "Continue to details"
                      : "Create apartment"}
                </button>
              </div>
            </div>
          </form>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
