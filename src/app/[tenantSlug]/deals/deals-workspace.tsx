"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
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
import { createDeal, moveDealStage, moveDealStageDirect } from "./actions";
import { getEntityTimelineLogs } from "../finance/actions";

type DealCard = {
  id: string;
  leadName: string;
  unitLabel: string;
  owner: string;
  value: string;
  pendingFinance: boolean;
  stage: DealStage;
};

type SelectOption = { id: string; label: string };
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
  deals,
  leads,
  units,
  users,
  defaultLeadId,
  activeFilterChips,
}: {
  tenantSlug: string;
  deals: DealCard[];
  leads: SelectOption[];
  units: SelectOption[];
  users: SelectOption[];
  defaultLeadId?: string;
  activeFilterChips?: ActiveFilterChip[];
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(Boolean(defaultLeadId));
  const [activeDeal, setActiveDeal] = useState<DealCard | null>(null);
  const [boardDeals, setBoardDeals] = useState<DealCard[]>(deals);
  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);
  const [hoverStage, setHoverStage] = useState<DealStage | null>(null);
  const [isDraggingSavePending, setIsDraggingSavePending] = useState(false);
  const [timelineDeal, setTimelineDeal] = useState<DealCard | null>(null);
  const [timelineLogs, setTimelineLogs] = useState<TimelineLogRow[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [createState, createAction, createPending] = useActionState(createDeal.bind(null, tenantSlug), initial);
  const [moveState, moveAction, movePending] = useActionState(
    moveDealStage.bind(null, tenantSlug, activeDeal?.id ?? ""),
    initial,
  );
  const { showSnackbar } = useSnackbar();
  const createFormRef = useRef<HTMLFormElement | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

  const grouped = useMemo(() => {
    const out = new Map<DealStage, DealCard[]>();
    for (const stage of STAGE_ORDER) out.set(stage, []);
    for (const deal of boardDeals) {
      if (!out.has(deal.stage)) out.set(deal.stage, []);
      out.get(deal.stage)!.push(deal);
    }
    return out;
  }, [boardDeals]);

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
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-8">
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
                className="text-xs font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-2"
              >
                Clear filters
              </a>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          New deal
        </button>
      </div>

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

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-foreground/10 bg-background p-5 shadow-2xl">
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
                <UiSelect id="deal-lead" name="leadId" defaultValue={defaultLeadId || ""}>
                  <option value="">None</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.label}
                    </option>
                  ))}
                </UiSelect>
              </div>
              <div>
                <label htmlFor="deal-unit" className="mb-1 block text-sm text-muted">
                  Unit (optional)
                </label>
                <UiSelect id="deal-unit" name="unitId" defaultValue="">
                  <option value="">None</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.label}
                    </option>
                  ))}
                </UiSelect>
              </div>

              <div>
                <label htmlFor="deal-owner" className="mb-1 block text-sm text-muted">
                  Assign owner
                </label>
                <UiSelect id="deal-owner" name="assignedUserId" defaultValue="">
                  <option value="">Use current user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.label}
                    </option>
                  ))}
                </UiSelect>
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
                  className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {createPending ? "Creating..." : "Create deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {activeDeal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-foreground/10 bg-background p-5 shadow-2xl">
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
                  className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {movePending ? "Saving..." : "Move stage"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {timelineDeal ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-[1px]">
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-foreground/10 bg-background p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
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
            {timelineLoading ? (
              <p className="mt-4 text-sm text-muted">Loading timeline...</p>
            ) : timelineLogs.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No timeline events yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {timelineLogs.map((log) => (
                  <li key={log.id} className="rounded-md border border-foreground/10 p-3">
                    <p className="text-xs text-muted">{log.timestamp}</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{log.action}</p>
                    <p className="text-xs text-muted">By: {log.actor}</p>
                    <p className="mt-1 text-sm text-foreground/90">{log.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
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
  isDragging,
  dragDisabled,
  onMoveClick,
  onTimelineClick,
}: {
  deal: DealCard;
  isDragging: boolean;
  dragDisabled: boolean;
  onMoveClick: () => void;
  onTimelineClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging: internalDragging } = useDraggable({
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
      <p className="font-semibold text-foreground">{deal.leadName}</p>
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
    </article>
  );
}
