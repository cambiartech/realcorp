"use client";

import { useState, useTransition } from "react";
import { useSnackbar } from "@/components/snackbar";
import { ModalOverlay } from "@/components/modal-overlay";
import { GlobalLocationFields } from "@/components/global-location-fields";
import { MODAL_PANEL_LG } from "@/lib/modal-panel";
import { deleteShortletProperty, saveShortletProperty } from "../actions";

type LocationRow = {
  id: string;
  name: string;
  locationCode: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  isActive: boolean;
  apartmentCount: number;
};

const EMPTY_FORM = {
  name: "",
  locationCode: "",
  address: "",
  city: "",
  state: "",
  country: "Nigeria",
  phone: "",
  email: "",
  isActive: true,
};

type Props = {
  tenantSlug: string;
  locations: LocationRow[];
};

export function LocationsWorkspace({ tenantSlug, locations }: Props) {
  const { showSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

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

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(row: LocationRow) {
    setEditId(row.id);
    setForm({
      name: row.name,
      locationCode: row.locationCode,
      address: row.address,
      city: row.city,
      state: row.state,
      country: row.country || "Nigeria",
      phone: row.phone,
      email: row.email,
      isActive: row.isActive,
    });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Locations</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Sites and buildings where your short-let apartments live — Akoka HQ, Lekki branch, etc.
            Independent from sales Projects.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
        >
          Add location
        </button>
      </div>

      {locations.length === 0 ? (
        <div className="rounded-lg border border-foreground/10 p-8 text-center">
          <p className="font-medium">No locations yet</p>
          <p className="mt-1 text-sm text-muted">Add your first site, then create apartments under it.</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            Add location
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-foreground/10">
          <table className="min-w-full text-sm">
            <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Apartments</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id} className="border-t border-foreground/10">
                  <td className="px-4 py-3 font-medium">{loc.name}</td>
                  <td className="px-4 py-3 text-muted">{loc.locationCode || "—"}</td>
                  <td className="px-4 py-3">{loc.city || "—"}</td>
                  <td className="px-4 py-3">{loc.apartmentCount}</td>
                  <td className="px-4 py-3">{loc.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => openEdit(loc)}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isPending || loc.apartmentCount > 0}
                        onClick={() =>
                          run(() => deleteShortletProperty(tenantSlug, loc.id), "Location deleted.")
                        }
                        className="rounded border border-[var(--danger-line)] px-2 py-1 text-xs text-[var(--danger)] disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <ModalOverlay open={open} onClose={() => setOpen(false)} panelClassName={MODAL_PANEL_LG}>
          <h2 className="text-lg font-bold">{editId ? "Edit location" : "Add location"}</h2>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  saveShortletProperty(tenantSlug, {
                    id: editId || undefined,
                    ...form,
                  }),
                editId ? "Location updated." : "Location created.",
                () => setOpen(false),
              );
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-muted sm:col-span-2">
                Location name
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </label>
              <label className="block text-sm text-muted">
                Location code
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="HQ"
                  value={form.locationCode}
                  onChange={(e) => setForm((f) => ({ ...f, locationCode: e.target.value }))}
                />
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                Active location
              </label>
            </div>
            <label className="block text-sm text-muted">
              Street address
              <textarea
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                rows={2}
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </label>
            <GlobalLocationFields
              key={editId || "new"}
              defaultCountry={form.country}
              defaultState={form.state}
              defaultCity={form.city}
              onLocationChange={(location) => setForm((current) => ({ ...current, ...location }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded-md border px-3 py-2 text-sm"
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <input
                type="email"
                className="rounded-md border px-3 py-2 text-sm"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background"
              >
                {editId ? "Update location" : "Create location"}
              </button>
            </div>
          </form>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
