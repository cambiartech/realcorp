"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSnackbar } from "@/components/snackbar";
import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_LG } from "@/lib/modal-panel";
import { UiSelect } from "@/components/ui-select";
import { runShortletEndOfDay, saveShortletPmsSettings, saveShortletServiceItem } from "../actions";

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

type SettingsTab = "operations" | "catalog";

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
  serviceItems: ServiceRow[];
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
  serviceItems,
}: Props) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [settings, setSettings] = useState(pmsSettings);
  const [editService, setEditService] = useState<ServiceRow | null>(null);
  const [serviceForm, setServiceForm] = useState({
    department: "FNB" as "FNB" | "LAUNDRY" | "LOUNGE" | "GYM" | "OTHER",
    name: "",
    price: "",
    currency: defaultCurrency,
  });

  function run(
    fn: () => Promise<{ ok: boolean; error?: string; businessDayId?: string }>,
    msg = "Saved.",
    onSuccess?: (res: { businessDayId?: string }) => void,
  ) {
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
        <SettingsTabBtn
          active={tab === "operations"}
          label="Operating times"
          onClick={() => router.push(`/${tenantSlug}/shortlets/settings?tab=operations`)}
        />
        <SettingsTabBtn
          active={tab === "catalog"}
          label="Service catalog"
          onClick={() => router.push(`/${tenantSlug}/shortlets/settings?tab=catalog`)}
        />
      </div>

      <section className="rounded-lg border border-foreground/10 p-4">
        <h2 className="font-semibold">Inventory</h2>
        <p className="mt-1 text-sm text-muted">
          Locations and apartments are managed under Short Lets — not tied to sales Projects unless you
          explicitly import a project unit.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/${tenantSlug}/shortlets/locations`}
            className="rounded-md border border-foreground/15 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.03]"
          >
            Manage locations
          </Link>
          <Link
            href={`/${tenantSlug}/shortlets/apartments`}
            className="rounded-md border border-foreground/15 px-3 py-2 text-sm font-medium hover:bg-foreground/[0.03]"
          >
            Manage apartments
          </Link>
        </div>
      </section>

      {tab === "operations" ? (
        <section className="rounded-lg border border-foreground/10 p-4">
          <h2 className="font-semibold">Operating times</h2>
          <p className="mt-1 text-sm text-muted">
            Check-in/out defaults, checkout alerts, and end-of-day close time.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block text-muted">Check-in time</span>
              <input
                type="time"
                className="w-full rounded-md border px-3 py-2"
                value={settings.checkInTime}
                onChange={(e) => setSettings((s) => ({ ...s, checkInTime: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">Check-out time</span>
              <input
                type="time"
                className="w-full rounded-md border px-3 py-2"
                value={settings.checkOutTime}
                onChange={(e) => setSettings((s) => ({ ...s, checkOutTime: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">End of day</span>
              <input
                type="time"
                className="w-full rounded-md border px-3 py-2"
                value={settings.eodTime}
                onChange={(e) => setSettings((s) => ({ ...s, eodTime: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">Checkout alert (hours)</span>
              <input
                type="number"
                min={1}
                max={24}
                className="w-full rounded-md border px-3 py-2"
                value={settings.checkoutAlertHours}
                onChange={(e) => setSettings((s) => ({ ...s, checkoutAlertHours: Number(e.target.value) }))}
              />
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
            Closes the business day and opens a printable night audit report for managers — occupancy, ADR,
            in-house guests, and revenue.
          </p>
        </section>
      ) : null}

      {tab === "catalog" ? (
        <section className="rounded-lg border border-foreground/10 p-4">
          <h2 className="font-semibold">Service catalog</h2>
          <p className="mt-1 text-sm text-muted">
            Prices for restaurant, laundry, lounge, and gym folio posting.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block text-sm text-muted">
              Department
              <UiSelect
                className="mt-1"
                value={serviceForm.department}
                onChange={(e) =>
                  setServiceForm((f) => ({ ...f, department: e.target.value as typeof f.department }))
                }
              >
                {DEPT_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </UiSelect>
            </label>
            <input
              className="rounded-md border px-3 py-2 text-sm"
              placeholder="Item name"
              value={serviceForm.name}
              onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              type="number"
              className="rounded-md border px-3 py-2 text-sm"
              placeholder="Price"
              value={serviceForm.price}
              onChange={(e) => setServiceForm((f) => ({ ...f, price: e.target.value }))}
            />
            <label className="block text-sm text-muted">
              Currency
              <UiSelect
                className="mt-1"
                value={serviceForm.currency}
                onChange={(e) => setServiceForm((f) => ({ ...f, currency: e.target.value }))}
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
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
                  () => {
                    setServiceForm((f) => ({ ...f, name: "", price: "" }));
                    router.refresh();
                  },
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
                    <span className={item.active ? "" : "text-muted line-through"}>
                      {item.department} · {item.name}
                    </span>
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
        <ModalOverlay
          open={Boolean(editService)}
          onClose={() => setEditService(null)}
          panelClassName={MODAL_PANEL_LG}
        >
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
                    s
                      ? {
                          ...s,
                          departmentValue: e.target.value as ServiceRow["departmentValue"],
                          department:
                            DEPT_OPTIONS.find((d) => d.value === e.target.value)?.label || s.department,
                        }
                      : s,
                  )
                }
              >
                {DEPT_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
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
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </UiSelect>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditService(null)}
                className="rounded-md border px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background"
              >
                Save changes
              </button>
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
