"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSnackbar } from "@/components/snackbar";
import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_LG } from "@/lib/modal-panel";
import { UiSelect } from "@/components/ui-select";
import {
  assignShortletUnitProperty,
  createShortletUnit,
  runShortletEndOfDay,
  saveShortletPmsSettings,
  saveShortletProperty,
  saveShortletServiceItem,
} from "../actions";

type PropertyRow = {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
  unitCount: number;
};

type UnitRow = {
  id: string;
  name: string;
  location: string;
  nightlyRateLabel: string;
  propertyId: string;
  propertyLabel: string;
};

type ServiceRow = {
  id: string;
  department: string;
  departmentValue: "FNB" | "LAUNDRY" | "LOUNGE" | "GYM" | "OTHER";
  name: string;
  price: number;
  priceLabel: string;
  currency: string;
  active: boolean;
};

type SettingsTab = "operations" | "inventory" | "catalog";

type Props = {
  tab: SettingsTab;
  tenantSlug: string;
  defaultCurrency: string;
  currencies: string[];
  pmsSettings: {
    checkInTime: string;
    checkOutTime: string;
    eodTime: string;
    checkoutAlertHours: number;
    financeSync: boolean;
  };
  moduleFinance: boolean;
  properties: PropertyRow[];
  units: UnitRow[];
  serviceItems: ServiceRow[];
  projectUnitOptions: Array<{ id: string; label: string }>;
};

const DEPT_OPTIONS = [
  { value: "FNB", label: "Restaurant / F&B" },
  { value: "LAUNDRY", label: "Laundry" },
  { value: "LOUNGE", label: "Lounge" },
  { value: "GYM", label: "Gym" },
  { value: "OTHER", label: "Other" },
];

export function SettingsWorkspace({
  tab,
  tenantSlug,
  defaultCurrency,
  currencies,
  pmsSettings,
  moduleFinance,
  properties,
  units,
  serviceItems,
  projectUnitOptions,
}: Props) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [settings, setSettings] = useState(pmsSettings);
  const [propertyForm, setPropertyForm] = useState({ name: "", address: "" });
  const [unitOpen, setUnitOpen] = useState(false);
  const [editService, setEditService] = useState<ServiceRow | null>(null);
  const [serviceForm, setServiceForm] = useState({
    department: "FNB" as "FNB" | "LAUNDRY" | "LOUNGE" | "GYM" | "OTHER",
    name: "",
    price: "",
    currency: defaultCurrency,
  });
  const [unitForm, setUnitForm] = useState({
    source: "CUSTOM" as "CUSTOM" | "PROJECT_UNIT",
    projectUnitId: projectUnitOptions[0]?.id || "",
    propertyId: properties[0]?.id || "",
    name: "",
    location: "",
    nightlyRate: "",
    cleaningFee: "",
    currency: defaultCurrency,
  });

  function run(fn: () => Promise<{ ok: boolean; error?: string; businessDayId?: string }>, msg = "Saved.", onSuccess?: (res: { businessDayId?: string }) => void) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        showSnackbar(msg, "success");
        onSuccess?.(res);
      } else {
        showSnackbar(res.error || "Could not save.", "error");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-foreground/10">
        <SettingsTabBtn active={tab === "operations"} label="Operating times" onClick={() => router.push(`/${tenantSlug}/shortlets/settings?tab=operations`)} />
        <SettingsTabBtn active={tab === "inventory"} label="Properties & rooms" onClick={() => router.push(`/${tenantSlug}/shortlets/settings?tab=inventory`)} />
        <SettingsTabBtn active={tab === "catalog"} label="Service catalog" onClick={() => router.push(`/${tenantSlug}/shortlets/settings?tab=catalog`)} />
      </div>

      {tab === "operations" ? (
      <section className="rounded-lg border border-foreground/10 p-4">
        <h2 className="font-semibold">Operating times</h2>
        <p className="mt-1 text-sm text-muted">Check-in/out defaults, checkout alerts, and end-of-day close time.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Check-in time</span>
            <input type="time" className="w-full rounded-md border px-3 py-2" value={settings.checkInTime} onChange={(e) => setSettings((s) => ({ ...s, checkInTime: e.target.value }))} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Check-out time</span>
            <input type="time" className="w-full rounded-md border px-3 py-2" value={settings.checkOutTime} onChange={(e) => setSettings((s) => ({ ...s, checkOutTime: e.target.value }))} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">End of day</span>
            <input type="time" className="w-full rounded-md border px-3 py-2" value={settings.eodTime} onChange={(e) => setSettings((s) => ({ ...s, eodTime: e.target.value }))} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Checkout alert (hours)</span>
            <input type="number" min={1} max={24} className="w-full rounded-md border px-3 py-2" value={settings.checkoutAlertHours} onChange={(e) => setSettings((s) => ({ ...s, checkoutAlertHours: Number(e.target.value) }))} />
          </label>
        </div>
        {moduleFinance ? (
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.financeSync}
              onChange={(e) => setSettings((s) => ({ ...s, financeSync: e.target.checked }))}
            />
            <span>Sync short-let payments to Finance as sales receipts</span>
          </label>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => saveShortletPmsSettings(tenantSlug, settings), "Settings saved.")}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            Save settings
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () => runShortletEndOfDay(tenantSlug),
                "Night audit saved.",
                (res) => {
                  if (res.businessDayId) {
                    router.push(`/${tenantSlug}/shortlets/reports/night-audit/${res.businessDayId}`);
                  } else {
                    router.push(`/${tenantSlug}/shortlets/reports?tab=night-audit`);
                  }
                },
              )
            }
            className="rounded-md border border-foreground/15 px-4 py-2 text-sm"
          >
            Run end of day
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          Closes the business day and opens a printable night audit report for managers — occupancy, ADR, in-house guests, and revenue.
        </p>
      </section>
      ) : null}

      {tab === "inventory" ? (
      <>
      {units.length === 0 ? (
        <section className="rounded-lg border border-foreground/20 bg-foreground/[0.03] p-4">
          <h2 className="font-semibold">Getting started — short-let only</h2>
          <p className="mt-2 text-sm text-muted">
            You don&apos;t need Projects, Deals, or sales inventory. Add your property (optional), then add each room with a nightly rate below.
            Turn on Finance sync under Operating times if you want payments to flow into Finance automatically.
          </p>
          <button
            type="button"
            onClick={() => setUnitOpen(true)}
            className="mt-4 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            Add your first room
          </button>
        </section>
      ) : null}

      <section className="rounded-lg border border-foreground/10 p-4">
        <h2 className="font-semibold">Properties</h2>
        <p className="mt-1 text-sm text-muted">Group rooms by building or location — Royal Residences, Annex, etc.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input className="rounded-md border px-3 py-2 text-sm" placeholder="Property name" value={propertyForm.name} onChange={(e) => setPropertyForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="rounded-md border px-3 py-2 text-sm" placeholder="Address (optional)" value={propertyForm.address} onChange={(e) => setPropertyForm((f) => ({ ...f, address: e.target.value }))} />
          <button
            type="button"
            disabled={isPending || propertyForm.name.trim().length < 2}
            onClick={() => {
              run(
                () => saveShortletProperty(tenantSlug, { name: propertyForm.name, address: propertyForm.address || undefined }),
                "Property added.",
              );
              setPropertyForm({ name: "", address: "" });
            }}
            className="rounded-md border border-foreground bg-foreground px-3 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            Add property
          </button>
        </div>
        {properties.length > 0 ? (
          <ul className="mt-4 divide-y divide-foreground/10 rounded-lg border border-foreground/10 text-sm">
            {properties.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <span className="font-medium">{p.name}</span>
                  {p.address ? <span className="ml-2 text-muted">· {p.address}</span> : null}
                  <span className="ml-2 text-xs text-muted">{p.unitCount} room{p.unitCount === 1 ? "" : "s"}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {units.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-muted">Assign rooms to property</p>
            <ul className="mt-2 space-y-2 text-sm">
              {units.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-foreground/10 px-3 py-2">
                  <span>{u.name}</span>
                  <UiSelect
                    className="min-w-[180px] text-sm"
                    value={u.propertyId}
                    onChange={(e) =>
                      run(
                        () => assignShortletUnitProperty(tenantSlug, { unitId: u.id, propertyId: e.target.value || undefined }),
                        "Room assigned.",
                      )
                    }
                  >
                    <option value="">Unassigned</option>
                    {properties.filter((p) => p.isActive).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </UiSelect>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-foreground/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Rooms</h2>
            <p className="mt-1 text-sm text-muted">
              Add each rentable room here — no link to Projects required. Use &quot;Custom room&quot; for standalone short-let businesses.
            </p>
          </div>
          <button type="button" onClick={() => setUnitOpen(true)} className="rounded-md border border-foreground bg-foreground px-3 py-2 text-sm font-semibold text-background">
            Add room
          </button>
        </div>
        {units.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-foreground/10">
            <table className="min-w-full text-sm">
              <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Nightly rate</th>
                  <th className="px-4 py-3">Property</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id} className="border-t border-foreground/10">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3">{u.location || "—"}</td>
                    <td className="px-4 py-3">{u.nightlyRateLabel}</td>
                    <td className="px-4 py-3">{u.propertyLabel || "Unassigned"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">No rooms yet. Click &quot;Add room&quot; to create your inventory.</p>
        )}
      </section>
      </>
      ) : null}

      {tab === "catalog" ? (
      <section className="rounded-lg border border-foreground/10 p-4">
        <h2 className="font-semibold">Service catalog</h2>
        <p className="mt-1 text-sm text-muted">Prices for restaurant, laundry, lounge, and gym folio posting.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-sm text-muted">
            Department
            <UiSelect className="mt-1" value={serviceForm.department} onChange={(e) => setServiceForm((f) => ({ ...f, department: e.target.value as typeof f.department }))}>
              {DEPT_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </UiSelect>
          </label>
          <input className="rounded-md border px-3 py-2 text-sm" placeholder="Item name" value={serviceForm.name} onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))} />
          <input type="number" className="rounded-md border px-3 py-2 text-sm" placeholder="Price" value={serviceForm.price} onChange={(e) => setServiceForm((f) => ({ ...f, price: e.target.value }))} />
          <label className="block text-sm text-muted">
            Currency
            <UiSelect className="mt-1" value={serviceForm.currency} onChange={(e) => setServiceForm((f) => ({ ...f, currency: e.target.value }))}>
              {currencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </UiSelect>
          </label>
          <button
            type="button"
            disabled={isPending || !serviceForm.name || !serviceForm.price}
            onClick={() =>
              run(
                () =>
                  saveShortletServiceItem(tenantSlug, {
                    department: serviceForm.department,
                    name: serviceForm.name,
                    price: Number(serviceForm.price),
                    currency: serviceForm.currency,
                  }),
                "Service item added.",
              )
            }
            className="self-end rounded-md border border-foreground bg-foreground px-3 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            Add item
          </button>
        </div>
        {serviceItems.length > 0 ? (
          <ul className="mt-4 divide-y divide-foreground/10 rounded-lg border border-foreground/10 text-sm">
            {serviceItems.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <span className={item.active ? "" : "text-muted line-through"}>{item.department} · {item.name}</span>
                  {!item.active ? <span className="ml-2 text-xs text-muted">(inactive)</span> : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.priceLabel}</span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setEditService(item)}
                    className="rounded border px-2 py-1 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      run(
                        () =>
                          saveShortletServiceItem(tenantSlug, {
                            id: item.id,
                            department: item.departmentValue,
                            name: item.name,
                            price: item.price,
                            currency: item.currency,
                            active: !item.active,
                          }),
                        item.active ? "Item deactivated." : "Item reactivated.",
                      )
                    }
                    className="rounded border px-2 py-1 text-xs"
                  >
                    {item.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      ) : null}

      {editService ? (
        <ModalOverlay open={Boolean(editService)} onClose={() => setEditService(null)} panelClassName={MODAL_PANEL_LG}>
            <h2 className="text-lg font-bold">Edit service item</h2>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    saveShortletServiceItem(tenantSlug, {
                      id: editService.id,
                      department: editService.departmentValue,
                      name: editService.name,
                      price: editService.price,
                      currency: editService.currency,
                      active: editService.active,
                    }),
                  "Service item updated.",
                );
                setEditService(null);
              }}
            >
              <label className="block text-sm text-muted">
                Department
                <UiSelect
                  className="mt-1"
                  value={editService.departmentValue}
                  onChange={(e) =>
                    setEditService((s) =>
                      s ? { ...s, departmentValue: e.target.value as ServiceRow["departmentValue"], department: DEPT_OPTIONS.find((d) => d.value === e.target.value)?.label || s.department } : s,
                    )
                  }
                >
                  {DEPT_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </UiSelect>
              </label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Item name"
                value={editService.name}
                onChange={(e) => setEditService((s) => (s ? { ...s, name: e.target.value } : s))}
                required
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="number"
                  className="rounded-md border px-3 py-2 text-sm"
                  placeholder="Price"
                  value={editService.price}
                  onChange={(e) => setEditService((s) => (s ? { ...s, price: Number(e.target.value) } : s))}
                  required
                />
                <label className="block text-sm text-muted">
                  Currency
                  <UiSelect
                    className="mt-1"
                    value={editService.currency}
                    onChange={(e) => setEditService((s) => (s ? { ...s, currency: e.target.value } : s))}
                  >
                    {currencies.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </UiSelect>
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditService(null)} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background">Save changes</button>
              </div>
            </form>
        </ModalOverlay>
      ) : null}

      {unitOpen ? (
        <ModalOverlay open={unitOpen} onClose={() => setUnitOpen(false)} panelClassName={MODAL_PANEL_LG}>
            <h2 className="text-lg font-bold">Add room</h2>
            <p className="mt-1 text-sm text-muted">Standalone short-let room — no project link required.</p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    createShortletUnit(tenantSlug, {
                      source: unitForm.source,
                      projectUnitId: unitForm.source === "PROJECT_UNIT" ? unitForm.projectUnitId : undefined,
                      propertyId: unitForm.propertyId || undefined,
                      name: unitForm.name,
                      location: unitForm.location || undefined,
                      nightlyRate: Number(unitForm.nightlyRate),
                      cleaningFee: unitForm.cleaningFee ? Number(unitForm.cleaningFee) : undefined,
                      currency: unitForm.currency,
                    }),
                  "Room added.",
                );
                setUnitOpen(false);
              }}
            >
              {projectUnitOptions.length > 0 ? (
                <label className="block text-sm text-muted">
                  Room type
                  <UiSelect className="mt-1" value={unitForm.source} onChange={(e) => setUnitForm((f) => ({ ...f, source: e.target.value as "CUSTOM" | "PROJECT_UNIT" }))}>
                    <option value="CUSTOM">Custom room (recommended)</option>
                    <option value="PROJECT_UNIT">Link to sales project unit (optional)</option>
                  </UiSelect>
                </label>
              ) : null}
              {unitForm.source === "PROJECT_UNIT" && projectUnitOptions.length > 0 ? (
                <label className="block text-sm text-muted">
                  Project unit
                  <UiSelect className="mt-1" value={unitForm.projectUnitId} onChange={(e) => setUnitForm((f) => ({ ...f, projectUnitId: e.target.value }))}>
                    {projectUnitOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </UiSelect>
                </label>
              ) : (
                <>
                  <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Room name (e.g. Room 12, Suite A)" value={unitForm.name} onChange={(e) => setUnitForm((f) => ({ ...f, name: e.target.value }))} required />
                  <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Location / building (optional)" value={unitForm.location} onChange={(e) => setUnitForm((f) => ({ ...f, location: e.target.value }))} />
                </>
              )}
              {properties.length > 0 ? (
                <label className="block text-sm text-muted">
                  Property
                  <UiSelect className="mt-1" value={unitForm.propertyId} onChange={(e) => setUnitForm((f) => ({ ...f, propertyId: e.target.value }))}>
                    <option value="">Unassigned</option>
                    {properties.filter((p) => p.isActive).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </UiSelect>
                </label>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <input type="number" className="rounded-md border px-3 py-2 text-sm" placeholder="Nightly rate" value={unitForm.nightlyRate} onChange={(e) => setUnitForm((f) => ({ ...f, nightlyRate: e.target.value }))} required />
                <input type="number" className="rounded-md border px-3 py-2 text-sm" placeholder="Cleaning fee" value={unitForm.cleaningFee} onChange={(e) => setUnitForm((f) => ({ ...f, cleaningFee: e.target.value }))} />
              </div>
              <label className="block text-sm text-muted">
                Currency
                <UiSelect className="mt-1" value={unitForm.currency} onChange={(e) => setUnitForm((f) => ({ ...f, currency: e.target.value }))}>
                  {currencies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </UiSelect>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setUnitOpen(false)} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background">Add</button>
              </div>
            </form>
        </ModalOverlay>
      ) : null}
    </div>
  );
}

function SettingsTabBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative px-3 py-2 text-sm font-medium transition-colors",
        active ? "text-foreground" : "text-muted hover:text-foreground",
      ].join(" ")}
    >
      {label}
      {active ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground" /> : null}
    </button>
  );
}
