"use client";

import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_LG } from "@/lib/modal-panel";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { DataExportMenu } from "@/components/shortlets/data-export-menu";
import { LeadQuality } from "@/generated/prisma";
import { FormAlert } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { SearchableSelect } from "@/components/searchable-select";
import { ButtonSpinner } from "@/components/button-spinner";
import { PaginationControl } from "@/components/pagination";
import type { Pagination, SearchParamValue } from "@/lib/pagination";
import { createLead } from "./actions";
import { TableSearch, filterTableRows } from "@/components/table-search";

type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  attribution: string;
  quality: string;
  score: number;
  lastActivityAt: string | null;
  owner: string;
  createdAt: string;
};

function ScoreBadge({ score }: { score: number }) {
  const hot = score >= 70;
  const warm = score >= 40;
  const ring = hot
    ? "bg-[var(--danger-wash)] text-[var(--danger)] ring-1 ring-[var(--danger-line)]"
    : warm
      ? "bg-[var(--warn-wash)] text-[var(--warn)] ring-1 ring-[var(--warn-line)]"
      : "bg-foreground/5 text-muted ring-1 ring-foreground/10";
  const label = hot ? "🔥" : warm ? "☀" : "❄";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${ring}`}
    >
      {label} {score}
    </span>
  );
}

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
  tenantName,
  leads,
  users,
  canCreate,
  projectOptions,
  campaignOptions,
  sourceOptions,
  activeFilterChips,
  pagination,
  paginationSearchParams,
}: {
  tenantSlug: string;
  tenantName: string;
  leads: LeadRow[];
  users: TeamUser[];
  canCreate: boolean;
  projectOptions: ProjectOption[];
  campaignOptions: CampaignOption[];
  sourceOptions: string[];
  activeFilterChips?: ActiveFilterChip[];
  pagination: Pagination;
  paginationSearchParams: Record<string, SearchParamValue>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createLead.bind(null, tenantSlug), initial);
  const { showSnackbar } = useSnackbar();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [tableQuery, setTableQuery] = useState("");
  const visibleLeads = useMemo(
    () =>
      filterTableRows(
        leads,
        tableQuery,
        (lead) =>
          `${lead.name} ${lead.email} ${lead.phone} ${lead.source} ${lead.attribution} ${lead.owner}`,
      ),
    [leads, tableQuery],
  );

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

  const leadExportRows = useMemo(
    () =>
      leads.map((l) => ({
        name: l.name,
        email: l.email,
        phone: l.phone,
        source: l.source,
        quality: l.quality,
        score: l.score,
        owner: l.owner,
        createdAt: l.createdAt,
      })),
    [leads],
  );

  const sourceBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of leads) map.set(l.source || "Unknown", (map.get(l.source || "Unknown") || 0) + 1);
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [leads]);

  const hotCount = leads.filter((l) => l.score >= 70).length;
  const warmCount = leads.filter((l) => l.score >= 40 && l.score < 70).length;

  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
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
                className="text-xs font-semibold text-[var(--info)] underline decoration-[var(--info-line)] underline-offset-2"
              >
                Clear filters
              </Link>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <DataExportMenu
            filename={`leads-${new Date().toISOString().slice(0, 10)}`}
            sheetName="Leads"
            headers={["Name", "Email", "Phone", "Source", "Quality", "Score", "Owner", "Created"]}
            keys={["name", "email", "phone", "source", "quality", "score", "owner", "createdAt"]}
            rows={leadExportRows}
            reportTitle="Leads Report"
            companyName={tenantName}
            kpis={[
              { label: "Leads on page", value: leads.length, tone: "highlight" },
              { label: "Hot (70+)", value: hotCount, tone: "positive" },
              { label: "Warm", value: warmCount },
              { label: "Cold", value: leads.length - hotCount - warmCount },
            ]}
            breakdowns={[{ title: "Leads by source", rows: sourceBreakdown }]}
          />
          {canCreate ? (
            <>
              <Link
                href={`/${tenantSlug}/leads/import`}
                className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
              >
                Import CSV
              </Link>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                New lead
              </button>
            </>
          ) : null}
        </div>
      </div>

      {campaignOptions.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Campaign</span>
          <div className="min-w-[16rem]">
            <SearchableSelect
              value={searchParams.get("campaign") ?? ""}
              onChange={(id) => {
                const next = new URLSearchParams(searchParams.toString());
                if (id) next.set("campaign", id);
                else next.delete("campaign");
                const q = next.toString();
                router.push(`/${tenantSlug}/leads${q ? `?${q}` : ""}`);
              }}
              allowEmpty
              emptyLabel="All campaigns"
              searchPlaceholder="Search campaigns…"
              options={campaignOptions.map((c) => ({ value: c.id, label: c.label }))}
            />
          </div>
        </div>
      ) : null}

      {/* Hot leads priority band */}
      {leads.some((l) => l.score >= 70) && (
        <div className="mt-5 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-wash)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-base">🔥</span>
            <span className="text-sm font-semibold text-[var(--danger)]">Hot leads — act now</span>
            <span className="rounded-full bg-[var(--danger-wash)] px-2 py-0.5 text-xs font-medium text-[var(--danger)]">
              {leads.filter((l) => l.score >= 70).length}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {leads
              .filter((l) => l.score >= 70)
              .slice(0, 8)
              .map((lead) => (
                <Link
                  key={lead.id}
                  href={`/${tenantSlug}/leads/${lead.id}`}
                  className="flex items-center gap-2 rounded-lg border border-[var(--danger-line)] bg-background px-3 py-2 text-sm shadow-sm hover:border-[var(--danger-line)] hover:shadow-md"
                >
                  <span className="font-medium text-foreground">{lead.name}</span>
                  <ScoreBadge score={lead.score} />
                  {lead.lastActivityAt && (
                    <span className="text-xs text-muted">last {lead.lastActivityAt}</span>
                  )}
                </Link>
              ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-3">
          <TableSearch
            value={tableQuery}
            onChange={setTableQuery}
            placeholder="Search leads by name, email, phone, source, or owner…"
            resultCount={visibleLeads.length}
            totalCount={leads.length}
          />
        </div>
      <div className="overflow-hidden rounded-lg border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Attribution</th>
              <th className="px-4 py-3">Last activity</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {visibleLeads.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-sm text-muted">
                  {leads.length === 0 ? "No leads yet." : "No leads match that search."}
                </td>
              </tr>
            ) : (
              visibleLeads.map((lead) => (
                <tr key={lead.id} className={lead.score >= 70 ? "bg-[var(--danger)]/[0.02]" : ""}>
                  <td className="px-4 py-3">
                    <ScoreBadge score={lead.score} />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    <Link
                      href={`/${tenantSlug}/leads/${lead.id}`}
                      className="hover:underline hover:decoration-foreground/30"
                    >
                      {lead.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <div>{lead.email}</div>
                    <div className="text-xs">{lead.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-muted">{lead.source}</td>
                  <td className="max-w-[200px] px-4 py-3 text-xs text-muted">{lead.attribution}</td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {lead.lastActivityAt ?? <span className="italic">Never</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">{lead.owner}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/${tenantSlug}/leads/${lead.id}`}
                        className="text-xs text-muted underline decoration-foreground/20 underline-offset-2 hover:text-foreground"
                      >
                        View
                      </Link>
                      <Link
                        href={`/${tenantSlug}/deals?leadId=${lead.id}`}
                        className="text-xs font-medium text-foreground underline decoration-foreground/20 underline-offset-2"
                      >
                        Convert to deal
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <PaginationControl
          pathname={`/${tenantSlug}/leads`}
          searchParams={paginationSearchParams}
          pageParam="leadsPage"
          itemLabel="leads"
          {...pagination}
        />
      </div>
      </div>

      <ModalOverlay
        open={Boolean(isCreateOpen)}
        onClose={() => setIsCreateOpen(false)}
        panelClassName={MODAL_PANEL_LG}
      >
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
            <UiSelect id="lead-source" name="source" defaultValue={sourceOptions[0] ?? ""}>
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
            <SearchableSelect
              id="lead-campaign-record"
              name="campaignId"
              defaultValue=""
              allowEmpty
              emptyLabel="None"
              searchPlaceholder="Search campaigns…"
              options={campaignOptions.map((c) => ({ value: c.id, label: c.label }))}
            />
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
            <SearchableSelect
              id="lead-project-interest"
              name="projectInterest"
              defaultValue=""
              allowEmpty
              emptyLabel="Not specified"
              searchPlaceholder="Search projects…"
              options={projectOptions.map((project) => ({ value: project.name, label: project.name }))}
            />
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
            <SearchableSelect
              id="lead-owner"
              name="assignedUserId"
              defaultValue=""
              allowEmpty
              emptyLabel="Unassigned"
              searchPlaceholder="Search team…"
              options={users.map((user) => ({ value: user.id, label: user.label }))}
            />
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
              aria-busy={pending}
              className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? <ButtonSpinner /> : null}
              {pending ? "Creating..." : "Create lead"}
            </button>
          </div>
        </form>
      </ModalOverlay>
    </div>
  );
}
