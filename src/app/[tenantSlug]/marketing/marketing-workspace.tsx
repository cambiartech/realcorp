"use client";

import { CampaignStatus } from "@/generated/prisma";
import { FormAlert } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { formatEnumLabel } from "@/lib/ui-format";
import { useActionState, useEffect, useRef, useState } from "react";
import { createCampaign } from "./actions";

type CampaignRow = {
  id: string;
  name: string;
  code: string;
  status: CampaignStatus;
  description: string | null;
  leadCount: number;
  createdAt: string;
};

type ActionResult = { ok: true } | { ok: false; error: string };
const initial: ActionResult | null = null;

export function MarketingWorkspace({
  tenantSlug,
  tenantName,
  canEdit,
  campaigns,
  attributionRows,
  summary,
}: {
  tenantSlug: string;
  tenantName: string;
  canEdit: boolean;
  campaigns: CampaignRow[];
  attributionRows: Array<{ label: string; count: number }>;
  summary: {
    totalLeads: number;
    attributedLeads: number;
    realtorLeads: number;
    activeCampaigns: number;
    attributionRatePct: number;
  };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createCampaign.bind(null, tenantSlug), initial);
  const { showSnackbar } = useSnackbar();
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      showSnackbar("Campaign created.", "success");
      formRef.current?.reset();
      queueMicrotask(() => setOpen(false));
    } else {
      showSnackbar(state.error, "error");
    }
  }, [showSnackbar, state]);

  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketing</h1>
          <p className="mt-1 text-sm text-muted">
            Campaigns and lead attribution for <span className="font-medium text-foreground">{tenantName}</span>.
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            New campaign
          </button>
        ) : null}
      </div>

      {!canEdit ? (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          You can view campaigns here. Org admins and marketing managers can create and edit campaigns.
        </p>
      ) : null}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total leads" value={summary.totalLeads} />
        <KpiCard label="Attributed" value={summary.attributedLeads} />
        <KpiCard label="Attribution rate" value={`${summary.attributionRatePct}%`} />
        <KpiCard label="Realtor-sourced" value={summary.realtorLeads} />
        <KpiCard label="Active campaigns" value={summary.activeCampaigns} />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Leads by campaign</h2>
        {attributionRows.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No leads linked to a campaign yet. Link leads when creating them or via UTM on realtor submissions.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {attributionRows.map((row) => (
              <li
                key={row.label}
                className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-4 py-3 text-sm"
              >
                <p className="font-medium text-foreground">{row.label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{row.count}</p>
                <p className="text-xs text-muted">Attributed leads</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Campaigns</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-foreground/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Leads</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-muted">
                    No campaigns yet. Create one to track UTM and form attribution.
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{c.code}</td>
                    <td className="px-4 py-3 text-muted">{formatEnumLabel(c.status)}</td>
                    <td className="px-4 py-3 text-foreground">{c.leadCount}</td>
                    <td className="px-4 py-3 text-muted">{c.createdAt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          Use the campaign <span className="font-mono">code</span> in UTM parameters (<span className="font-mono">utm_campaign</span>) on
          realtor portal links or landing pages.
        </p>
      </section>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-foreground/10 bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Create campaign</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06]"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <form ref={formRef} action={formAction} className="mt-4 grid gap-3">
              {state && !state.ok ? (
                <FormAlert>{state.error}</FormAlert>
              ) : null}
              <div>
                <label className="mb-1 block text-sm text-muted">Name</label>
                <input
                  name="name"
                  required
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Code (UTM / slug)</label>
                <input
                  name="code"
                  required
                  placeholder="e.g. spring-launch-2026"
                  className="w-full border border-foreground/15 bg-field px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
                <p className="mt-1 text-xs text-muted">Lowercase letters, numbers, hyphens. Unique per workspace.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Status</label>
                <UiSelect name="status" defaultValue={CampaignStatus.ACTIVE}>
                  <option value={CampaignStatus.DRAFT}>Draft</option>
                  <option value={CampaignStatus.ACTIVE}>Active</option>
                  <option value={CampaignStatus.PAUSED}>Paused</option>
                  <option value={CampaignStatus.ENDED}>Ended</option>
                </UiSelect>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
                >
                  {pending ? "Saving..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
