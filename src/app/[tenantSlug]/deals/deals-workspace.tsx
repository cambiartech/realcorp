"use client";

import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_DRAWER_MD, MODAL_PANEL_LG, MODAL_PANEL_SM } from "@/lib/modal-panel";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { DataExportMenu } from "@/components/shortlets/data-export-menu";
import {
  closestCorners,
  DndContext,
  DragOverEvent,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { DealStage } from "@/generated/prisma";
import { FormAlert } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { SearchableSelect, groupSearchableOptions } from "@/components/searchable-select";
import { ButtonSpinner } from "@/components/button-spinner";
import { PaginationControl } from "@/components/pagination";
import { buildPageUrl, type Pagination, type SearchParamValue } from "@/lib/pagination";
import { createDeal, moveDealStage, moveDealStageDirect } from "./actions";
import { getEntityTimelineLogs } from "../finance/actions";
import { TableSearch, filterTableRows } from "@/components/table-search";

type DealCard = {
  id: string;
  leadId: string | null;
  leadName: string;
  leadScore: number;
  unitLabel: string;
  projectName: string;
  projectId: string | null;
  owner: string;
  value: string;
  pendingFinance: boolean;
  stage: DealStage;
  createdAt: string;
};

type ViewMode = "kanban" | "list";

type SelectOption = { id: string; label: string; group?: string };
type ActiveFilterChip = { label: string; clearHref: string };
type ActionResult = { ok: true } | { ok: false; error: string };
type TimelineLogRow = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  summary: string;
};
const initial: ActionResult | null = null;

const STAGE_ORDER: DealStage[] = [
  DealStage.NEW_LEAD,
  DealStage.CONTACTED,
  DealStage.QUALIFIED,
  DealStage.INSPECTION_BOOKED,
  DealStage.INSPECTION_COMPLETED,
  DealStage.NEGOTIATION,
  DealStage.RESERVATION_MADE,
  DealStage.CLOSED_WON,
  DealStage.CLOSED_LOST,
];

const STAGE_LABEL: Record<DealStage, string> = {
  NEW_LEAD: "New Lead",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  INSPECTION_BOOKED: "Inspection Booked",
  INSPECTION_COMPLETED: "Inspection Completed",
  NEGOTIATION: "Negotiation",
  RESERVATION_MADE: "Reservation Made",
  CLOSED_WON: "Closed Won",
  CLOSED_LOST: "Closed Lost",
};

export function DealsWorkspace({
  tenantSlug,
  tenantName,
  deals,
  leads,
  units,
  users,
  defaultLeadId,
  activeFilterChips,
  initialView = "kanban",
  pagination,
  paginationSearchParams,
}: {
  tenantSlug: string;
  tenantName: string;
  deals: DealCard[];
  leads: SelectOption[];
  units: SelectOption[];
  users: SelectOption[];
  defaultLeadId?: string;
  activeFilterChips?: ActiveFilterChip[];
  initialView?: ViewMode;
  pagination: Pagination;
  paginationSearchParams: Record<string, SearchParamValue>;
}) {
  const viewMode = initialView;
  const [isCreateOpen, setIsCreateOpen] = useState(Boolean(defaultLeadId));
  const [activeDeal, setActiveDeal] = useState<DealCard | null>(null);
  const [boardDeals, setBoardDeals] = useState<DealCard[]>(deals);
  const [tableQuery, setTableQuery] = useState("");
  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);
  const [hoverStage, setHoverStage] = useState<DealStage | null>(null);
  const [isDraggingSavePending, setIsDraggingSavePending] = useState(false);
  const [timelineDeal, setTimelineDeal] = useState<DealCard | null>(null);
  const [timelineLogs, setTimelineLogs] = useState<TimelineLogRow[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [createState, createAction, createPending] = useActionState(
    createDeal.bind(null, tenantSlug),
    initial,
  );
  const [moveState, moveAction, movePending] = useActionState(
    moveDealStage.bind(null, tenantSlug, activeDeal?.id ?? ""),
    initial,
  );
  const { showSnackbar } = useSnackbar();
  const createFormRef = useRef<HTMLFormElement | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const unitGroups = useMemo(
    () =>
      groupSearchableOptions(
        units.map((unit) => ({
          value: unit.id,
          label: unit.group ? `${unit.group} · ${unit.label}` : unit.label,
          group: unit.group,
          keywords: `${unit.group ?? ""} ${unit.label}`,
        })),
      ),
    [units],
  );

  useEffect(() => {
    setBoardDeals(deals);
  }, [deals]);

  useEffect(() => {
    if (!createState) return;
    if (createState.ok) {
      showSnackbar("Deal created successfully.", "success");
      createFormRef.current?.reset();
      setIsCreateOpen(false);
    } else {
      showSnackbar(createState.error, "error");
    }
  }, [createState, showSnackbar]);

  useEffect(() => {
    if (!moveState) return;
    if (moveState.ok) {
      showSnackbar("Deal stage updated.", "success");
      setActiveDeal(null);
    } else {
      showSnackbar(moveState.error, "error");
    }
  }, [moveState, showSnackbar]);

  const visibleBoardDeals = useMemo(
    () =>
      filterTableRows(
        boardDeals,
        tableQuery,
        (deal) =>
          `${deal.leadName} ${deal.unitLabel} ${deal.projectName} ${deal.owner} ${deal.value} ${STAGE_LABEL[deal.stage]}`,
      ),
    [boardDeals, tableQuery],
  );

  const grouped = useMemo(() => {
    const out = new Map<DealStage, DealCard[]>();
    for (const stage of STAGE_ORDER) out.set(stage, []);
    for (const deal of visibleBoardDeals) {
      if (!out.has(deal.stage)) out.set(deal.stage, []);
      out.get(deal.stage)!.push(deal);
    }
    return out;
  }, [visibleBoardDeals]);

  function parseDealValue(raw: string) {
    return parseFloat(raw.replace(/[^\d.-]/g, "")) || 0;
  }

  const dealExportRows = useMemo(
    () =>
      boardDeals.map((d) => ({
        lead: d.leadName,
        project: d.projectName,
        unit: d.unitLabel,
        stage: STAGE_LABEL[d.stage],
        value: d.value,
        owner: d.owner,
        createdAt: d.createdAt,
      })),
    [boardDeals],
  );

  const stageBreakdown = useMemo(
    () =>
      STAGE_ORDER.map((stage) => ({
        label: STAGE_LABEL[stage],
        value: boardDeals.filter((d) => d.stage === stage).length,
      })).filter((x) => x.value > 0),
    [boardDeals],
  );

  const pipelineValue = useMemo(
    () =>
      boardDeals.filter((d) => d.stage !== "CLOSED_LOST").reduce((s, d) => s + parseDealValue(d.value), 0),
    [boardDeals],
  );

  const wonCount = boardDeals.filter((d) => d.stage === "CLOSED_WON").length;
  const openCount = boardDeals.filter((d) => d.stage !== "CLOSED_WON" && d.stage !== "CLOSED_LOST").length;

  async function handleDrop(targetStage: DealStage) {
    if (isDraggingSavePending) return;
    const deal = boardDeals.find((d) => d.id === draggingDealId);
    setHoverStage(null);
    setDraggingDealId(null);
    if (!deal || deal.stage === targetStage) return;

    const prevDeals = boardDeals;
    setBoardDeals((curr) => curr.map((d) => (d.id === deal.id ? { ...d, stage: targetStage } : d)));

    setIsDraggingSavePending(true);
    const result = await moveDealStageDirect(tenantSlug, deal.id, targetStage);
    if (!result.ok) {
      setBoardDeals(prevDeals);
      showSnackbar(result.error, "error");
      setIsDraggingSavePending(false);
      return;
    }
    showSnackbar("Deal moved successfully.", "success");
    setIsDraggingSavePending(false);
  }

  function handleDragStart(event: DragStartEvent) {
    if (isDraggingSavePending) return;
    const activeId = String(event.active.id);
    setDraggingDealId(activeId);
  }

  function handleDragOver(event: DragOverEvent) {
    if (!event.over) {
      if (hoverStage !== null) setHoverStage(null);
      return;
    }
    const maybeStage = String(event.over.id) as DealStage;
    if (STAGE_ORDER.includes(maybeStage) && hoverStage !== maybeStage) {
      setHoverStage(maybeStage);
    }
  }

  function handleDragCancel() {
    setDraggingDealId(null);
    setHoverStage(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id;
    if (!overId) {
      handleDragCancel();
      return;
    }
    const stage = String(overId) as DealStage;
    if (!STAGE_ORDER.includes(stage)) {
      handleDragCancel();
      return;
    }
    handleDrop(stage);
  }

  async function openTimeline(deal: DealCard) {
    setTimelineDeal(deal);
    setTimelineLoading(true);
    const result = await getEntityTimelineLogs(tenantSlug, "DEAL", deal.id);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setTimelineLogs([]);
      setTimelineLoading(false);
      return;
    }
    setTimelineLogs(result.logs);
    setTimelineLoading(false);
  }

  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deals</h1>
          <p className="mt-1 text-sm text-muted">Pipeline execution board from lead to close.</p>
          {activeFilterChips && activeFilterChips.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <a
                  key={chip.label}
                  href={chip.clearHref}
                  className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.08]"
                  title={`Remove ${chip.label}`}
                >
                  <span>{chip.label}</span>
                  <span aria-hidden>×</span>
                </a>
              ))}
              <a
                href={`/${tenantSlug}/deals`}
                className="text-xs font-semibold text-[var(--info)] underline decoration-[var(--info-line)] underline-offset-2"
              >
                Clear filters
              </a>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TableSearch
            value={tableQuery}
            onChange={setTableQuery}
            placeholder="Search deals by lead, unit, project, or owner…"
            resultCount={visibleBoardDeals.length}
            totalCount={boardDeals.length}
            className="max-w-xs flex-none"
          />
          {/* View toggle */}
          <div className="flex overflow-hidden rounded-md border border-foreground/15">
            <Link
              href={buildPageUrl(
                `/${tenantSlug}/deals`,
                { ...paginationSearchParams, view: "kanban" },
                "dealsPage",
                1,
              )}
              title="Kanban view"
              aria-label="Show deals in Kanban view"
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "kanban" ? "bg-foreground text-background" : "text-muted hover:bg-foreground/[0.06]"}`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="5" height="18" rx="1" />
                <rect x="10" y="3" width="5" height="12" rx="1" />
                <rect x="17" y="3" width="4" height="15" rx="1" />
              </svg>
            </Link>
            <Link
              href={buildPageUrl(
                `/${tenantSlug}/deals`,
                { ...paginationSearchParams, view: "list" },
                "dealsPage",
                1,
              )}
              title="List view"
              aria-label="Show deals in list view"
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-foreground text-background" : "text-muted hover:bg-foreground/[0.06]"}`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" strokeLinecap="round" />
                <line x1="3" y1="12" x2="3.01" y2="12" strokeLinecap="round" />
                <line x1="3" y1="18" x2="3.01" y2="18" strokeLinecap="round" />
              </svg>
            </Link>
          </div>
          <DataExportMenu
            filename={`sales-pipeline-${new Date().toISOString().slice(0, 10)}`}
            sheetName="Deals"
            headers={["Lead", "Project", "Unit", "Stage", "Value", "Owner", "Created"]}
            keys={["lead", "project", "unit", "stage", "value", "owner", "createdAt"]}
            rows={dealExportRows}
            reportTitle="Sales Pipeline"
            companyName={tenantName}
            kpis={[
              { label: "Open deals", value: openCount, tone: "highlight" },
              { label: "Closed won", value: wonCount, tone: "positive" },
              { label: "Pipeline value", value: pipelineValue, tone: "default" },
              { label: "Deals on page", value: boardDeals.length },
            ]}
            breakdowns={[{ title: "Deals by stage", rows: stageBreakdown }]}
          />
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            New deal
          </button>
        </div>
      </div>

      {/* List view */}
      {viewMode === "list" && (
        <div className="mt-5 overflow-hidden rounded-lg border border-foreground/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Unit / Project</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10">
              {visibleBoardDeals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-sm text-muted">
                    {boardDeals.length === 0 ? "No deals yet." : "No deals match that search."}
                  </td>
                </tr>
              ) : (
                visibleBoardDeals.map((deal) => (
                  <tr key={deal.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {deal.leadId ? (
                          <Link
                            href={`/${tenantSlug}/leads/${deal.leadId}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {deal.leadName}
                          </Link>
                        ) : (
                          <span className="font-medium text-foreground">{deal.leadName}</span>
                        )}
                        {deal.leadScore > 0 && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${deal.leadScore >= 70 ? "bg-[var(--danger-wash)] text-[var(--danger)]" : deal.leadScore >= 40 ? "bg-[var(--warn-wash)] text-[var(--warn)]" : "bg-foreground/5 text-muted"}`}
                          >
                            {deal.leadScore}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${deal.stage === "CLOSED_WON" ? "bg-[var(--success-wash)] text-[var(--success)]" : deal.stage === "CLOSED_LOST" ? "bg-[var(--danger-wash)] text-[var(--danger)]" : deal.stage === "RESERVATION_MADE" ? "bg-[var(--warn-wash)] text-[var(--warn)]" : "bg-foreground/5 text-muted"}`}
                      >
                        {STAGE_LABEL[deal.stage]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{deal.value}</td>
                    <td className="px-4 py-3 text-muted">
                      <div>{deal.unitLabel}</div>
                      <div className="text-xs">{deal.projectName}</div>
                    </td>
                    <td className="px-4 py-3 text-muted">{deal.owner}</td>
                    <td className="px-4 py-3 text-xs text-muted">{deal.createdAt}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/${tenantSlug}/deals/${deal.id}`}
                        className="text-xs font-medium text-foreground underline decoration-foreground/20 underline-offset-2 hover:opacity-70"
                      >
                        Full view →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Kanban board */}
      {viewMode === "kanban" && (
        <div className="mt-6 overflow-x-auto pb-2">
          <DndContext
            id="tenant-deals-board"
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="grid min-w-[1280px] grid-cols-9 gap-3">
              {STAGE_ORDER.map((stage) => (
                <StageColumn
                  key={stage}
                  stage={stage}
                  count={grouped.get(stage)?.length ?? 0}
                  active={hoverStage === stage}
                >
                  <div className="space-y-2 p-2">
                    {(grouped.get(stage) ?? []).map((deal) => (
                      <DealCardItem
                        key={deal.id}
                        deal={deal}
                        tenantSlug={tenantSlug}
                        isDragging={draggingDealId === deal.id}
                        dragDisabled={isDraggingSavePending}
                        onMoveClick={() => setActiveDeal(deal)}
                        onTimelineClick={() => openTimeline(deal)}
                      />
                    ))}
                    {(grouped.get(stage)?.length ?? 0) === 0 ? (
                      <p className="rounded-md border border-dashed border-foreground/15 p-2 text-[11px] text-muted">
                        No deals
                      </p>
                    ) : null}
                  </div>
                </StageColumn>
              ))}
            </div>
          </DndContext>
        </div>
      )}

      <div className="mt-3 overflow-hidden rounded-lg border border-foreground/10">
        <PaginationControl
          pathname={`/${tenantSlug}/deals`}
          searchParams={paginationSearchParams}
          pageParam="dealsPage"
          itemLabel="deals"
          {...pagination}
        />
      </div>

      <ModalOverlay
        open={Boolean(isCreateOpen)}
        onClose={() => setIsCreateOpen(false)}
        panelClassName={MODAL_PANEL_LG}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Create deal</h2>
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

        <form ref={createFormRef} action={createAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          {createState && !createState.ok ? (
            <div className="sm:col-span-2">
              <FormAlert>{createState.error}</FormAlert>
            </div>
          ) : null}

          <div>
            <label htmlFor="deal-lead" className="mb-1 block text-sm text-muted">
              Lead (optional)
            </label>
            <SearchableSelect
              id="deal-lead"
              name="leadId"
              defaultValue={defaultLeadId || ""}
              allowEmpty
              emptyLabel="None"
              searchPlaceholder="Search leads…"
              placeholder="Select a lead"
              options={leads.map((lead) => ({ value: lead.id, label: lead.label }))}
            />
          </div>
          <div>
            <label htmlFor="deal-unit" className="mb-1 block text-sm text-muted">
              Unit (optional)
            </label>
            <SearchableSelect
              id="deal-unit"
              name="unitId"
              defaultValue=""
              allowEmpty
              emptyLabel="None"
              searchPlaceholder="Search project or unit…"
              placeholder="Select a unit"
              groups={unitGroups}
            />
          </div>

          <div>
            <label htmlFor="deal-owner" className="mb-1 block text-sm text-muted">
              Assign owner
            </label>
            <SearchableSelect
              id="deal-owner"
              name="assignedUserId"
              defaultValue=""
              allowEmpty
              emptyLabel="Use current user"
              searchPlaceholder="Search team…"
              options={users.map((user) => ({ value: user.id, label: user.label }))}
            />
          </div>
          <div>
            <label htmlFor="deal-value" className="mb-1 block text-sm text-muted">
              Deal value (optional)
            </label>
            <input
              id="deal-value"
              name="value"
              inputMode="decimal"
              className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>

          <div>
            <label htmlFor="deal-stage" className="mb-1 block text-sm text-muted">
              Stage
            </label>
            <UiSelect id="deal-stage" name="stage" defaultValue={DealStage.NEW_LEAD}>
              {Object.values(DealStage).map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABEL[stage]}
                </option>
              ))}
            </UiSelect>
          </div>
          <label className="mt-6 inline-flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="pendingFinance" className="h-4 w-4 accent-black" />
            Mark as pending finance
          </label>

          <div className="sm:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPending}
              aria-busy={createPending}
              className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {createPending ? <ButtonSpinner /> : null}
              {createPending ? "Creating..." : "Create deal"}
            </button>
          </div>
        </form>
      </ModalOverlay>

      {activeDeal ? (
        <ModalOverlay open onClose={() => setActiveDeal(null)} panelClassName={MODAL_PANEL_SM}>
          <h2 className="text-lg font-semibold text-foreground">Move deal stage</h2>
          <p className="mt-1 text-sm text-muted">{activeDeal.leadName}</p>
          {moveState && !moveState.ok ? <FormAlert>{moveState.error}</FormAlert> : null}
          <form action={moveAction} className="mt-4 space-y-3">
            <UiSelect name="stage" defaultValue={activeDeal.stage}>
              {Object.values(DealStage).map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABEL[stage]}
                </option>
              ))}
            </UiSelect>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveDeal(null)}
                className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={movePending}
                aria-busy={movePending}
                className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {movePending ? <ButtonSpinner /> : null}
                {movePending ? "Saving..." : "Move stage"}
              </button>
            </div>
          </form>
        </ModalOverlay>
      ) : null}

      {timelineDeal ? (
        <ModalOverlay
          open
          onClose={() => setTimelineDeal(null)}
          variant="drawer"
          panelClassName={MODAL_DRAWER_MD}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-foreground/10 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Deal Timeline</h2>
              <p className="text-xs text-muted">{timelineDeal.leadName}</p>
            </div>
            <button
              type="button"
              onClick={() => setTimelineDeal(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
              aria-label="Close timeline"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pt-4">
            {timelineLoading ? (
              <p className="text-sm text-muted">Loading timeline...</p>
            ) : timelineLogs.length === 0 ? (
              <p className="text-sm text-muted">No timeline events yet.</p>
            ) : (
              <ul className="space-y-2">
                {timelineLogs.map((log) => (
                  <li key={log.id} className="rounded-md border border-foreground/10 bg-foreground/[0.02] p-3">
                    <p className="text-xs text-muted">{log.timestamp}</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{log.action}</p>
                    <p className="text-xs text-muted">By: {log.actor}</p>
                    <p className="mt-1 text-sm text-foreground/90">{log.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ModalOverlay>
      ) : null}
    </div>
  );
}

function StageColumn({
  stage,
  count,
  active,
  children,
}: {
  stage: DealStage;
  count: number;
  active: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({
    id: stage,
    data: { stage },
  });

  return (
    <section
      ref={setNodeRef}
      className={[
        "rounded-lg border bg-foreground/[0.02] transition-colors",
        active ? "border-foreground/40" : "border-foreground/10",
      ].join(" ")}
    >
      <header className="border-b border-foreground/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {STAGE_LABEL[stage]} ({count})
      </header>
      {children}
    </section>
  );
}

function DealCardItem({
  deal,
  tenantSlug,
  isDragging,
  dragDisabled,
  onMoveClick,
  onTimelineClick,
}: {
  deal: DealCard;
  tenantSlug: string;
  isDragging: boolean;
  dragDisabled: boolean;
  onMoveClick: () => void;
  onTimelineClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: internalDragging,
  } = useDraggable({
    id: deal.id,
    data: { stage: deal.stage },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={[
        "touch-none rounded-md border border-foreground/10 bg-background p-2 text-xs",
        isDragging || internalDragging ? "opacity-60" : "",
      ].join(" ")}
    >
      <Link
        href={`/${tenantSlug}/deals/${deal.id}`}
        className="block font-semibold text-foreground hover:underline hover:decoration-foreground/30"
      >
        {deal.leadName}
      </Link>
      <p className="mt-0.5 text-muted">{deal.unitLabel}</p>
      <p className="mt-0.5 text-muted">Owner: {deal.owner}</p>
      <p className="mt-0.5 text-foreground/90">{deal.value}</p>
      {deal.pendingFinance ? <p className="mt-1 text-[11px] text-error">Pending finance</p> : null}
      <button
        type="button"
        {...(dragDisabled ? {} : attributes)}
        {...(dragDisabled ? {} : listeners)}
        disabled={dragDisabled}
        className="mt-1 rounded border border-foreground/15 px-1.5 py-0.5 text-[10px] font-medium text-muted hover:bg-foreground/[0.04]"
      >
        {dragDisabled ? "Saving..." : "Drag"}
      </button>
      <button
        type="button"
        onClick={onMoveClick}
        className="mt-2 block text-[11px] font-medium text-foreground underline decoration-foreground/25 underline-offset-2"
      >
        Move stage
      </button>
      <button
        type="button"
        onClick={onTimelineClick}
        className="mt-1 block text-[11px] text-muted underline decoration-foreground/20 underline-offset-2 hover:text-foreground"
      >
        Timeline
      </button>
      <Link
        href={`/${tenantSlug}/deals/${deal.id}`}
        className="mt-1 block text-[11px] text-muted underline decoration-foreground/20 underline-offset-2 hover:text-foreground"
      >
        Full view →
      </Link>
    </article>
  );
}
