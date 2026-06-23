"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSnackbar } from "@/components/snackbar";
import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_LG, MODAL_PANEL_XL } from "@/lib/modal-panel";
import { UiSelect } from "@/components/ui-select";
import { createShortletUnit, saveShortletUnit } from "../actions";

const AMENITIES = ["WiFi", "AC", "Parking", "TV", "Kitchen", "Pool", "Generator", "Security", "Laundry", "Balcony"];

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
}: Props) {
  const { showSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultCurrency, locationOptions[0]?.id || ""));

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
    setForm(emptyForm(defaultCurrency, locationOptions[0]?.id || ""));
    setOpen(true);
  }

  function openEdit(row: ApartmentRow) {
    setEditId(row.id);
    setForm(rowToForm(row));
    setOpen(true);
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
    cautionFee: form.cautionFee ? Number(form.cautionFee) : undefined,
    currency: form.currency,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Apartments</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Short-let inventory — standalone or linked to a sales project unit as a last resort. Not every project unit is an apartment.
          </p>
          {locationOptions.length === 0 ? (
            <p className="mt-2 text-sm text-amber-700">
              <Link href={`/${tenantSlug}/shortlets/locations`} className="underline">Add a location</Link> first, then create apartments here.
            </p>
          ) : null}
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

      {apartments.length === 0 ? (
        <div className="rounded-lg border border-foreground/10 p-8 text-center">
          <p className="font-medium">No apartments yet</p>
          <p className="mt-1 text-sm text-muted">Create custom apartments for short-let-only tenants — no Projects module required.</p>
          {locationOptions.length > 0 ? (
            <button type="button" onClick={openCreate} className="mt-4 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background">
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
              {apartments.map((a) => (
                <tr key={a.id} className="border-t border-foreground/10">
                  <td className="px-4 py-3">
                    <div className="font-medium">{a.name}</div>
                    {a.linkedProjectUnit ? <div className="text-xs text-muted">Linked: {a.linkedProjectUnit}</div> : null}
                  </td>
                  <td className="px-4 py-3">{a.locationName || "—"}</td>
                  <td className="px-4 py-3">{a.roomLayout || "—"}</td>
                  <td className="px-4 py-3">{a.nightlyRateLabel}</td>
                  <td className="px-4 py-3">{a.listingStatus}</td>
                  <td className="px-4 py-3">{a.housekeepingStatus}</td>
                  <td className="px-4 py-3">
                    <button type="button" disabled={isPending} onClick={() => openEdit(a)} className="rounded border px-2 py-1 text-xs">
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
        <ModalOverlay open={open} onClose={() => setOpen(false)} panelClassName={MODAL_PANEL_XL}>
          <h2 className="text-lg font-bold">{editId ? "Edit apartment" : "Add apartment"}</h2>
          <p className="mt-1 text-sm text-muted">
            {editId ? "Update rates, layout, and listing status." : "Custom apartment — default for short-let-only businesses."}
          </p>
          <form
            className="mt-4 grid gap-6 lg:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
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
            <div className="space-y-3 lg:col-span-2">
              {!editId && projectUnitOptions.length > 0 ? (
                <details className="rounded-md border border-foreground/10 p-3 text-sm">
                  <summary className="cursor-pointer font-medium text-muted">Advanced: import from sales project unit</summary>
                  <p className="mt-2 text-xs text-muted">Only when converting an owned sales unit to short-let ops.</p>
                  <label className="mt-3 block text-sm text-muted">
                    Source
                    <UiSelect className="mt-1" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as FormState["source"] }))}>
                      <option value="CUSTOM">Custom apartment (recommended)</option>
                      <option value="PROJECT_UNIT">Import from project unit</option>
                    </UiSelect>
                  </label>
                  {form.source === "PROJECT_UNIT" ? (
                    <label className="mt-3 block text-sm text-muted">
                      Project unit
                      <UiSelect className="mt-1" value={form.projectUnitId} onChange={(e) => setForm((f) => ({ ...f, projectUnitId: e.target.value }))} required>
                        <option value="">Select unit…</option>
                        {projectUnitOptions.map((o) => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </UiSelect>
                    </label>
                  ) : null}
                </details>
              ) : null}

              {form.source !== "PROJECT_UNIT" ? (
                <label className="block text-sm text-muted">
                  Apartment name
                  <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                </label>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <input className="rounded-md border px-3 py-2 text-sm" placeholder="Floor (e.g. 2nd Floor)" value={form.floor} onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))} />
                <input className="rounded-md border px-3 py-2 text-sm" placeholder="Rooms (e.g. Studio, 2 Bed 1 Bath)" value={form.roomLayout} onChange={(e) => setForm((f) => ({ ...f, roomLayout: e.target.value }))} />
                <input type="number" className="rounded-md border px-3 py-2 text-sm" placeholder="Size (sq ft)" value={form.sizeSqFt} onChange={(e) => setForm((f) => ({ ...f, sizeSqFt: e.target.value }))} />
                <input type="number" className="rounded-md border px-3 py-2 text-sm" placeholder="Max occupancy" value={form.maxOccupancy} onChange={(e) => setForm((f) => ({ ...f, maxOccupancy: e.target.value }))} />
              </div>
              <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={3} placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Amenities</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {AMENITIES.map((a) => (
                    <label key={a} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.amenities.includes(a)} onChange={() => toggleAmenity(a)} />
                      {a}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm text-muted">
                Location
                <UiSelect className="mt-1" value={form.propertyId} onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))} required>
                  <option value="">Select location…</option>
                  {locationOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </UiSelect>
              </label>
              <label className="block text-sm text-muted">
                Listing status
                <UiSelect className="mt-1" value={form.listingStatus} onChange={(e) => setForm((f) => ({ ...f, listingStatus: e.target.value as FormState["listingStatus"] }))}>
                  <option value="AVAILABLE">Available</option>
                  <option value="UNAVAILABLE">Unavailable</option>
                  <option value="MAINTENANCE">Maintenance</option>
                </UiSelect>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                Active listing
              </label>
              <input type="number" className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Rate per night" value={form.nightlyRate} onChange={(e) => setForm((f) => ({ ...f, nightlyRate: e.target.value }))} required />
              <input type="number" className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Cleaning fee" value={form.cleaningFee} onChange={(e) => setForm((f) => ({ ...f, cleaningFee: e.target.value }))} />
              <input type="number" className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Caution fee" value={form.cautionFee} onChange={(e) => setForm((f) => ({ ...f, cautionFee: e.target.value }))} />
              <label className="block text-sm text-muted">
                Currency
                <UiSelect className="mt-1" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                  {currencies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </UiSelect>
              </label>
              <div className="flex flex-col gap-2 pt-2">
                <button type="submit" disabled={isPending} className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background">
                  {editId ? "Update apartment" : "Create apartment"}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
              </div>
            </div>
          </form>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
