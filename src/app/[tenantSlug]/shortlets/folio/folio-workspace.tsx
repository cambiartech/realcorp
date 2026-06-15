"use client";

import { useState, useTransition } from "react";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { DataExportMenu } from "@/components/shortlets/data-export-menu";
import { postShortletFolioCharge } from "../actions";

type FolioLine = {
  id: string;
  guestName: string;
  unitName: string;
  department: string;
  description: string;
  amountLabel: string;
  postedAtLabel: string;
};

type ServiceItem = {
  id: string;
  department: string;
  name: string;
  priceLabel: string;
  price: number;
};

type Props = {
  tenantSlug: string;
  activeStays: Array<{ id: string; label: string }>;
  serviceItems: ServiceItem[];
  recentLines: FolioLine[];
};

const DEPARTMENTS = [
  { value: "FNB", label: "Restaurant / F&B" },
  { value: "LAUNDRY", label: "Laundry" },
  { value: "LOUNGE", label: "Lounge" },
  { value: "GYM", label: "Gym" },
  { value: "OTHER", label: "Other" },
];

export function FolioWorkspace({ tenantSlug, activeStays, serviceItems, recentLines }: Props) {
  const { showSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    reservationId: activeStays[0]?.id || "",
    department: "FNB" as "FNB" | "LAUNDRY" | "LOUNGE" | "GYM" | "OTHER",
    serviceItemId: "",
    description: "",
    quantity: "1",
    unitPrice: "",
  });

  const deptItems = serviceItems.filter((s) => s.department === form.department);

  function postCharge() {
    startTransition(async () => {
      const res = await postShortletFolioCharge(tenantSlug, {
        reservationId: form.reservationId,
        department: form.department,
        serviceItemId: form.serviceItemId || undefined,
        description: form.description,
        quantity: Number(form.quantity) || 1,
        unitPrice: Number(form.unitPrice),
      });
      if (res.ok) showSnackbar("Charge posted to folio.", "success");
      else showSnackbar(res.error || "Could not post.", "error");
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="rounded-lg border border-foreground/10 p-4">
        <h2 className="font-semibold text-foreground">Guest bill — post charge to room</h2>
        <p className="mt-1 text-sm text-muted">
          A folio is the guest&apos;s running bill (room, restaurant, laundry, etc.). Post charges here and they appear on the guest bill at checkout.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm text-muted">
            Active stay
            <UiSelect className="mt-1" value={form.reservationId} onChange={(e) => setForm((f) => ({ ...f, reservationId: e.target.value }))}>
              {activeStays.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </UiSelect>
          </label>
          <label className="block text-sm text-muted">
            Department
            <UiSelect
              className="mt-1"
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value as typeof f.department, serviceItemId: "", unitPrice: "" }))}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </UiSelect>
          </label>
          {deptItems.length > 0 ? (
            <label className="block text-sm text-muted">
              From catalog (optional)
              <UiSelect
                className="mt-1"
                value={form.serviceItemId}
                onChange={(e) => {
                  const v = e.target.value;
                  const item = deptItems.find((x) => x.id === v);
                  setForm((f) => ({
                    ...f,
                    serviceItemId: v,
                    description: item?.name || f.description,
                    unitPrice: item ? String(item.price) : f.unitPrice,
                  }));
                }}
              >
                <option value="">Custom item</option>
                {deptItems.map((i) => (
                  <option key={i.id} value={i.id}>{i.name} — {i.priceLabel}</option>
                ))}
              </UiSelect>
            </label>
          ) : null}
          <input
            className="w-full rounded-md border border-foreground/15 px-3 py-2 text-sm"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              min={1}
              className="rounded-md border border-foreground/15 px-3 py-2 text-sm"
              placeholder="Qty"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            />
            <input
              type="number"
              min={0}
              step="0.01"
              className="rounded-md border border-foreground/15 px-3 py-2 text-sm"
              placeholder="Unit price"
              value={form.unitPrice}
              onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
            />
          </div>
          <button
            type="button"
            disabled={isPending || !form.reservationId || !form.description || !form.unitPrice}
            onClick={postCharge}
            className="w-full rounded-md bg-foreground py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            Post to folio
          </button>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-foreground">Recent folio activity</h2>
          <DataExportMenu
            filename="shortlets-folio-activity"
            sheetName="Folio"
            headers={["Guest", "Room", "Department", "Item", "Amount", "Posted"]}
            keys={["guest", "room", "department", "item", "amount", "posted"]}
            rows={recentLines.map((l) => ({
              guest: l.guestName,
              room: l.unitName,
              department: l.department,
              item: l.description,
              amount: l.amountLabel,
              posted: l.postedAtLabel,
            }))}
            showPdf={false}
          />
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-foreground/10">
          <table className="min-w-full text-sm">
            <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Dept</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Posted</th>
              </tr>
            </thead>
            <tbody>
              {recentLines.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-muted">No folio charges yet.</td></tr>
              ) : (
                recentLines.map((line) => (
                  <tr key={line.id} className="border-t border-foreground/10">
                    <td className="px-4 py-3">{line.guestName}<br /><span className="text-xs text-muted">{line.unitName}</span></td>
                    <td className="px-4 py-3">{line.department}</td>
                    <td className="px-4 py-3">{line.description}</td>
                    <td className="px-4 py-3">{line.amountLabel}</td>
                    <td className="px-4 py-3">{line.postedAtLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
