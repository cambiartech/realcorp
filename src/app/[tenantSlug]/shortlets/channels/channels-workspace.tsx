"use client";

import { useState, useTransition } from "react";
import { useSnackbar } from "@/components/snackbar";
import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_LG } from "@/lib/modal-panel";
import { UiSelect } from "@/components/ui-select";
import { importChannelLeadAsReservation } from "../actions";

type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  projectInterest: string;
  notes: string;
  createdAtLabel: string;
};

type Props = {
  tenantSlug: string;
  defaultCheckInTime: string;
  defaultCheckOutTime: string;
  leads: LeadRow[];
  unitOptions: Array<{ id: string; label: string }>;
  propertyOptions: Array<{ id: string; label: string }>;
};

export function ChannelsWorkspace({
  tenantSlug,
  defaultCheckInTime,
  defaultCheckOutTime,
  leads,
  unitOptions,
  propertyOptions,
}: Props) {
  const { showSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [importLead, setImportLead] = useState<LeadRow | null>(null);
  const [form, setForm] = useState({
    unitId: "",
    propertyId: propertyOptions[0]?.id || "",
    checkIn: "",
    checkInTime: defaultCheckInTime,
    checkOut: "",
    checkOutTime: defaultCheckOutTime,
    notes: "",
  });

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg = "Saved.") {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        showSnackbar(msg, "success");
        setImportLead(null);
      } else {
        showSnackbar(res.error || "Could not save.", "error");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Channel inquiries</h2>
        <p className="mt-1 text-sm text-muted">
          Explore, WhatsApp, and other inbound leads ready to convert into short-let reservations.
        </p>
      </div>

      {leads.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 p-6 text-sm text-muted">
          No pending channel inquiries. New Explore and WhatsApp leads will appear here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-foreground/10">
          <table className="min-w-full text-sm">
            <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Interest</th>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t border-foreground/10">
                  <td className="px-4 py-3">
                    <div className="font-medium">{lead.name}</div>
                    <div className="text-xs text-muted">{lead.phone || lead.email || "No contact"}</div>
                  </td>
                  <td className="px-4 py-3">{lead.source}</td>
                  <td className="px-4 py-3">{lead.projectInterest || "—"}</td>
                  <td className="px-4 py-3">{lead.createdAtLabel}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setImportLead(lead);
                        setForm((f) => ({
                          ...f,
                          unitId: "",
                          propertyId: propertyOptions[0]?.id || "",
                          notes: lead.notes.slice(0, 500),
                        }));
                      }}
                      className="rounded border border-foreground/15 px-2 py-1 text-xs hover:bg-foreground/[0.06] disabled:opacity-50"
                    >
                      Create reservation
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {importLead ? (
        <ModalOverlay open={Boolean(importLead)} onClose={() => setImportLead(null)} panelClassName={MODAL_PANEL_LG}>
            <h2 className="text-lg font-bold">Import channel booking</h2>
            <p className="mt-1 text-sm text-muted">
              {importLead.name} · {importLead.source}
            </p>
            <p className="mt-1 text-sm text-muted">
              Creates a pending reservation. Apartment can be assigned later at check-in.
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    importChannelLeadAsReservation(tenantSlug, {
                      leadId: importLead.id,
                      unitId: form.unitId || undefined,
                      propertyId: form.propertyId || undefined,
                      checkIn: form.checkIn,
                      checkInTime: form.checkInTime,
                      checkOut: form.checkOut,
                      checkOutTime: form.checkOutTime,
                      notes: form.notes || undefined,
                    }),
                  "Reservation created from channel inquiry.",
                );
              }}
            >
              {propertyOptions.length > 0 ? (
                <label className="block text-sm text-muted">
                  Location
                  <UiSelect className="mt-1" value={form.propertyId} onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}>
                    <option value="">Select location (optional if apartment chosen)</option>
                    {propertyOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </UiSelect>
                </label>
              ) : null}
              <label className="block text-sm text-muted">
                Apartment <span className="text-xs">(optional)</span>
                <UiSelect className="mt-1" value={form.unitId} onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}>
                  <option value="">Assign later</option>
                  {unitOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </UiSelect>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="date" className="rounded-md border px-3 py-2 text-sm" value={form.checkIn} onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.value }))} required />
                <input type="time" className="rounded-md border px-3 py-2 text-sm" value={form.checkInTime} onChange={(e) => setForm((f) => ({ ...f, checkInTime: e.target.value }))} required />
                <input type="date" className="rounded-md border px-3 py-2 text-sm" value={form.checkOut} onChange={(e) => setForm((f) => ({ ...f, checkOut: e.target.value }))} required />
                <input type="time" className="rounded-md border px-3 py-2 text-sm" value={form.checkOutTime} onChange={(e) => setForm((f) => ({ ...f, checkOutTime: e.target.value }))} required />
              </div>
              <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={3} placeholder="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setImportLead(null)} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={isPending} className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background">Create reservation</button>
              </div>
            </form>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
