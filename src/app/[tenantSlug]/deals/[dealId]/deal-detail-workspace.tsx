"use client";

import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_LG, MODAL_PANEL_MD, MODAL_PANEL_SM, MODAL_PANEL_XL, MODAL_PANEL_XS, MODAL_PANEL_2XL } from "@/lib/modal-panel";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { DealStage } from "@/generated/prisma";
import { FormAlert } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { ButtonSpinner } from "@/components/button-spinner";
import { ActivityFeed, type ActivityRow } from "@/components/activity-feed";
import { updateDeal, moveDealStage } from "../actions";

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

const STAGE_ACCENT: Record<string, string> = {
  CLOSED_WON: "bg-green-500",
  CLOSED_LOST: "bg-red-500",
  RESERVATION_MADE: "bg-amber-500",
};

const STAGE_BADGE: Record<string, string> = {
  CLOSED_WON: "bg-green-500/15 text-green-700 border border-green-500/25",
  CLOSED_LOST: "bg-red-500/15 text-red-700 border border-red-500/25",
  RESERVATION_MADE: "bg-amber-500/15 text-amber-700 border border-amber-500/25",
};

type DealData = {
  id: string;
  stage: DealStage;
  stageLabel: string;
  stageIndex: number;
  value: string | null;
  valueRaw: string | null;
  pendingFinance: boolean;
  financeDecision: string | null;
  assignedUserId: string | null;
  ownerLabel: string;
  createdAt: string;
  updatedAt: string;
};

type LeadInfo = { id: string; name: string; email: string | null; phone: string | null } | null;
type UnitInfo = {
  id: string;
  label: string;
  purpose: string;
  unitType: string | null;
  status: string;
  projectId: string | null;
  projectName: string;
} | null;

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  amount: string;
  balanceDue: string;
  dueDate: string;
  issuedAt: string;
};

type ActionResult = { ok: true } | { ok: false; error: string };
const initial: ActionResult | null = null;

export function DealDetailWorkspace({
  tenantSlug,
  canEdit,
  deal,
  lead,
  unit,
  invoices,
  stageOrder,
  activities,
  users,
  currentUserId,
}: {
  tenantSlug: string;
  canEdit: boolean;
  deal: DealData;
  lead: LeadInfo;
  unit: UnitInfo;
  invoices: InvoiceRow[];
  stageOrder: DealStage[];
  activities: ActivityRow[];
  users: { id: string; label: string }[];
  currentUserId: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [editState, editAction, editPending] = useActionState(
    updateDeal.bind(null, tenantSlug, deal.id),
    initial,
  );
  const [moveState, moveAction, movePending] = useActionState(
    moveDealStage.bind(null, tenantSlug, deal.id),
    initial,
  );
  const { showSnackbar } = useSnackbar();
  const editFormRef = useRef<HTMLFormElement | null>(null);
  const moveFormRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!editState) return;
    if (editState.ok) {
      showSnackbar("Deal updated.", "success");
      setIsEditing(false);
    } else {
      showSnackbar(editState.error, "error");
    }
  }, [editState, showSnackbar]);

  useEffect(() => {
    if (!moveState) return;
    if (moveState.ok) {
      showSnackbar("Stage updated.", "success");
      setIsMoving(false);
    } else {
      showSnackbar(moveState.error, "error");
    }
  }, [moveState, showSnackbar]);

  const badgeStyle = STAGE_BADGE[deal.stage] ?? "bg-foreground/10 text-foreground border border-foreground/15";
  const stageAccent = STAGE_ACCENT[deal.stage] ?? "bg-foreground";

  const title = [lead?.name, unit?.label].filter(Boolean).join(" · ") || "Deal";

  return (
    <div className="w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/${tenantSlug}/deals`}
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            Back to deals
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeStyle}`}>
              {deal.stageLabel}
            </span>
            {deal.pendingFinance ? (
              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                Pending finance
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {deal.value ?? "No value"} · {deal.ownerLabel} · Created {deal.createdAt}
          </p>
        </div>
        {canEdit ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMoving(true)}
              className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/[0.06]"
            >
              Move stage
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
            >
              Edit deal
            </button>
          </div>
        ) : null}
      </div>

      {/* Stage progress timeline */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex min-w-max items-center gap-0">
          {stageOrder.map((stage, i) => {
            const isDone = i < deal.stageIndex;
            const isCurrent = i === deal.stageIndex;
            const isLast = i === stageOrder.length - 1;
            return (
              <div key={stage} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={[
                      "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold",
                      isDone
                        ? "border-foreground bg-foreground text-background"
                        : isCurrent
                          ? `border-foreground ${STAGE_ACCENT[stage] ?? "bg-foreground"} text-background`
                          : "border-foreground/20 bg-transparent text-muted",
                    ].join(" ")}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>
                  <p
                    className={[
                      "mt-1 max-w-[72px] text-center text-[9px] leading-tight",
                      isCurrent ? "font-semibold text-foreground" : "text-muted",
                    ].join(" ")}
                  >
                    {STAGE_LABEL[stage]}
                  </p>
                </div>
                {!isLast ? (
                  <div
                    className={[
                      "mx-1 h-0.5 w-8 shrink-0",
                      isDone ? "bg-foreground" : "bg-foreground/15",
                    ].join(" ")}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left: info cards */}
        <div className="space-y-4 lg:col-span-1">
          {/* Deal info */}
          <section className="rounded-lg border border-foreground/10 bg-foreground/[0.015] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">Deal info</p>
            <dl className="space-y-2 text-sm">
              <InfoRow label="Value" value={deal.value} />
              <InfoRow label="Owner" value={deal.ownerLabel} />
              <InfoRow label="Finance" value={deal.financeDecision ? deal.financeDecision.replace(/_/g, " ") : deal.pendingFinance ? "Pending" : "N/A"} />
              <InfoRow label="Updated" value={deal.updatedAt} />
            </dl>
          </section>

          {/* Lead card */}
          {lead ? (
            <section className="rounded-lg border border-foreground/10 bg-foreground/[0.015] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">Lead</p>
              <dl className="space-y-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <dt className="shrink-0 text-muted">Name</dt>
                  <dd className="text-right">
                    <Link href={`/${tenantSlug}/leads/${lead.id}`} className="font-medium text-foreground underline decoration-foreground/30 hover:opacity-80">
                      {lead.name}
                    </Link>
                  </dd>
                </div>
                <InfoRow label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} />
                <InfoRow label="Phone" value={lead.phone} href={lead.phone ? `tel:${lead.phone}` : undefined} />
              </dl>
            </section>
          ) : null}

          {/* Unit card */}
          {unit ? (
            <section className="rounded-lg border border-foreground/10 bg-foreground/[0.015] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">Unit</p>
              <dl className="space-y-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <dt className="shrink-0 text-muted">Unit</dt>
                  <dd className="text-right font-medium text-foreground">{unit.label}</dd>
                </div>
                <InfoRow label="Project" value={unit.projectName} href={unit.projectId ? `/${tenantSlug}/projects/${unit.projectId}` : undefined} />
                <InfoRow label="Purpose" value={unit.purpose} />
                <InfoRow label="Layout" value={unit.unitType} />
                <InfoRow label="Status" value={unit.status} />
              </dl>
            </section>
          ) : null}
        </div>

        {/* Right: invoices + activities */}
        <div className="space-y-6 lg:col-span-2">
          {/* Invoices */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">
              Invoices ({invoices.length})
            </p>
            {invoices.length === 0 ? (
              <div className="rounded-lg border border-foreground/10 p-5 text-center text-sm text-muted">
                No invoices yet.{" "}
                <Link href={`/${tenantSlug}/finance`} className="underline decoration-foreground/30 hover:text-foreground">
                  Go to Finance
                </Link>{" "}
                to create one.
              </div>
            ) : (
              <div className="divide-y divide-foreground/10 overflow-hidden rounded-lg border border-foreground/10">
                {invoices.map((inv) => (
                  <div key={inv.id} className="grid grid-cols-2 gap-2 px-4 py-3 text-sm sm:grid-cols-5">
                    <div>
                      <p className="font-medium text-foreground">{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted">Issued {inv.issuedAt}</p>
                    </div>
                    <p className="text-muted">{inv.status}</p>
                    <p className="text-muted">{inv.amount}</p>
                    <div>
                      <p className="text-xs text-muted">Balance: {inv.balanceDue}</p>
                      <p className="text-xs text-muted">Due {inv.dueDate}</p>
                    </div>
                    <div className="text-right">
                      <Link
                        href={`/${tenantSlug}/finance/invoices/${inv.id}`}
                        className="text-xs font-semibold text-foreground underline decoration-foreground/30 hover:decoration-foreground"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Activity feed */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">
              Activity feed
            </p>
            <ActivityFeed
              tenantSlug={tenantSlug}
              entityType="DEAL"
              entityId={deal.id}
              initialActivities={activities}
              users={users}
              currentUserId={currentUserId}
              canManage={canEdit}
            />
          </section>
        </div>
      </div>

      {/* Edit modal */}
      <ModalOverlay open={Boolean(isEditing)} onClose={() => setIsEditing(false)} panelClassName={MODAL_PANEL_SM}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Edit deal</h2>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <form ref={editFormRef} action={editAction} className="mt-4 space-y-3">
              {editState && !editState.ok ? <FormAlert>{editState.error}</FormAlert> : null}
              <div>
                <label className="mb-1 block text-xs text-muted">Deal value (NGN)</label>
                <input
                  name="value"
                  inputMode="decimal"
                  defaultValue={deal.valueRaw ?? ""}
                  placeholder="e.g. 45000000"
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Assigned owner</label>
                <UiSelect name="assignedUserId" defaultValue={deal.assignedUserId ?? ""}>
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
                </UiSelect>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  name="pendingFinance"
                  defaultChecked={deal.pendingFinance}
                  className="h-4 w-4 accent-black"
                />
                Mark as pending finance
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editPending}
                  aria-busy={editPending}
                  className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
                >
                  {editPending ? <ButtonSpinner /> : null}
                  {editPending ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
      </ModalOverlay>

      {/* Move stage modal */}
      <ModalOverlay open={Boolean(isMoving)} onClose={() => setIsMoving(false)} panelClassName={MODAL_PANEL_XS}>
            <h2 className="text-lg font-semibold text-foreground">Move stage</h2>
            <p className="mt-1 text-sm text-muted">Current: {deal.stageLabel}</p>
            {moveState && !moveState.ok ? <FormAlert>{moveState.error}</FormAlert> : null}
            <form ref={moveFormRef} action={moveAction} className="mt-4 space-y-3">
              <UiSelect name="stage" defaultValue={deal.stage}>
                {stageOrder.map((s) => (
                  <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                ))}
              </UiSelect>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMoving(false)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={movePending}
                  aria-busy={movePending}
                  className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
                >
                  {movePending ? <ButtonSpinner /> : null}
                  {movePending ? "Saving…" : "Move stage"}
                </button>
              </div>
            </form>
      </ModalOverlay>
    </div>
  );
}

function InfoRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right text-foreground">
        {href ? (
          <a href={href} className="underline decoration-foreground/30 hover:opacity-80">{value}</a>
        ) : value}
      </dd>
    </div>
  );
}
