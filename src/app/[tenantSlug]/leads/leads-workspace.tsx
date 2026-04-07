"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { LeadQuality } from "@/generated/prisma";
import { FormAlert } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { createLead } from "./actions";

type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  attribution: string;
  quality: string;
  owner: string;
  createdAt: string;
};

type TeamUser = {
  id: string;
  label: string;
};
type ProjectOption = {
  id: string;
  name: string;
};

type CampaignOption = {
  id: string;
  label: string;
};

type ActionResult = { ok: true } | { ok: false; error: string };
type ActiveFilterChip = { label: string; clearHref: string };
const initial: ActionResult | null = null;

export function LeadsWorkspace({
  tenantSlug,
  leads,
  users,
  canCreate,
  projectOptions,
  campaignOptions,
  sourceOptions,
  activeFilterChips,
}: {
  tenantSlug: string;
  leads: LeadRow[];
  users: TeamUser[];
  canCreate: boolean;
  projectOptions: ProjectOption[];
  campaignOptions: CampaignOption[];
  sourceOptions: string[];
  activeFilterChips?: ActiveFilterChip[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createLead.bind(null, tenantSlug), initial);
  const { showSnackbar } = useSnackbar();
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      showSnackbar("Lead created successfully.", "success");
      formRef.current?.reset();
      queueMicrotask(() => setIsCreateOpen(false));
    } else {
      showSnackbar(state.error, "error");
    }
  }, [showSnackbar, state]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="mt-1 text-sm text-muted">Capture and manage prospects before they become deals.</p>
          {activeFilterChips && activeFilterChips.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <Link
                  key={chip.label}
                  href={chip.clearHref}
                  className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.08]"
                  title={`Remove ${chip.label}`}
                >
                  <span>{chip.label}</span>
                  <span aria-hidden>×</span>
                </Link>
              ))}
              <Link
                href={`/${tenantSlug}/leads`}
                className="text-xs font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-2"
              >
                Clear filters
              </Link>
            </div>
          ) : null}
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            New lead
          </button>
        ) : null}
      </div>

      {campaignOptions.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Campaign</span>
          <UiSelect
            value={searchParams.get("campaign") ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              const next = new URLSearchParams(searchParams.toString());
              if (id) next.set("campaign", id);
              else next.delete("campaign");
              const q = next.toString();
              router.push(`/${tenantSlug}/leads${q ? `?${q}` : ""}`);
            }}
            className="max-w-xs text-sm"
          >
            <option value="">All campaigns</option>
            {campaignOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </UiSelect>
        </div>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-lg border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Attribution</th>
              <th className="px-4 py-3">Quality</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-sm text-muted">
                  No leads yet.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{lead.name}</td>
                  <td className="px-4 py-3 text-muted">
                    <div>{lead.email}</div>
                    <div className="text-xs">{lead.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-muted">{lead.source}</td>
                  <td className="max-w-[200px] px-4 py-3 text-xs text-muted">{lead.attribution}</td>
                  <td className="px-4 py-3 text-foreground/90">{lead.quality}</td>
                  <td className="px-4 py-3 text-muted">{lead.owner}</td>
                  <td className="px-4 py-3 text-muted">{lead.createdAt}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${tenantSlug}/deals?leadId=${lead.id}`}
                      className="text-xs font-medium text-foreground underline decoration-foreground/20 underline-offset-2"
                    >
                      Convert to deal
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-foreground/10 bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Create lead</h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <form ref={formRef} action={formAction} className="mt-4 grid gap-3 sm:grid-cols-2">
              {state && !state.ok ? (
                <div className="sm:col-span-2">
                  <FormAlert>{state.error}</FormAlert>
                </div>
              ) : null}

              <div className="sm:col-span-2">
                <label htmlFor="lead-name" className="mb-1 block text-sm text-muted">
                  Lead name
                </label>
                <input
                  id="lead-name"
                  name="name"
                  required
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>

              <div>
                <label htmlFor="lead-email" className="mb-1 block text-sm text-muted">
                  Email
                </label>
                <input
                  id="lead-email"
                  name="email"
                  type="text"
                  inputMode="email"
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label htmlFor="lead-phone" className="mb-1 block text-sm text-muted">
                  Phone
                </label>
                <input
                  id="lead-phone"
                  name="phone"
                  type="text"
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>

              <div>
                <label htmlFor="lead-source" className="mb-1 block text-sm text-muted">
                  Source
                </label>
                <UiSelect
                  id="lead-source"
                  name="source"
                  defaultValue={sourceOptions[0] ?? ""}
                >
                  {sourceOptions.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </UiSelect>
              </div>
              <div>
                <label htmlFor="lead-campaign-record" className="mb-1 block text-sm text-muted">
                  Link to campaign
                </label>
                <UiSelect id="lead-campaign-record" name="campaignId" defaultValue="">
                  <option value="">None</option>
                  {campaignOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </UiSelect>
              </div>
              <div>
                <label htmlFor="lead-campaign" className="mb-1 block text-sm text-muted">
                  Campaign name (free text)
                </label>
                <input
                  id="lead-campaign"
                  name="campaignName"
                  placeholder="e.g. Rio Q2"
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>

              <div>
                <label htmlFor="lead-project-interest" className="mb-1 block text-sm text-muted">
                  Project interest
                </label>
                <UiSelect
                  id="lead-project-interest"
                  name="projectInterest"
                  defaultValue=""
                >
                  <option value="">Not specified</option>
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.name}>
                      {project.name}
                    </option>
                  ))}
                </UiSelect>
              </div>
              <div>
                <label htmlFor="lead-budget" className="mb-1 block text-sm text-muted">
                  Budget range
                </label>
                <input
                  id="lead-budget"
                  name="budgetRange"
                  placeholder="e.g. NGN 50m - 80m"
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>

              <div>
                <label htmlFor="lead-quality" className="mb-1 block text-sm text-muted">
                  Quality
                </label>
                <UiSelect id="lead-quality" name="quality" defaultValue={LeadQuality.WARM}>
                  <option value={LeadQuality.HOT}>Hot</option>
                  <option value={LeadQuality.WARM}>Warm</option>
                  <option value={LeadQuality.COLD}>Cold</option>
                </UiSelect>
              </div>
              <div>
                <label htmlFor="lead-owner" className="mb-1 block text-sm text-muted">
                  Assign owner
                </label>
                <UiSelect id="lead-owner" name="assignedUserId" defaultValue="">
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.label}
                    </option>
                  ))}
                </UiSelect>
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "Creating..." : "Create lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
