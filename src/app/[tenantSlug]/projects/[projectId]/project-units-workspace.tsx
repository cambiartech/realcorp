"use client";

import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_LG, MODAL_PANEL_MD, MODAL_PANEL_SM, MODAL_PANEL_XL, MODAL_PANEL_XS, MODAL_PANEL_2XL } from "@/lib/modal-panel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { UnitPurpose, UnitStatus } from "@/generated/prisma";
import { FormAlert, FormFieldError } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { CurrencySelect } from "@/components/finance/currency-select";
import { ButtonSpinner } from "@/components/button-spinner";
import {
  createPricingPlan,
  createUnit,
  createUnitsBulk,
  deletePricingPlan,
  deleteUnit,
  reserveUnit,
  unreserveUnit,
  updatePricingPlan,
  updateUnit,
} from "../actions";
import { AddUnitsModal } from "./add-units-modal";

type UnitRow = {
  id: string;
  label: string;
  purpose: string;
  purposeValue: UnitPurpose;
  unitType: string;
  status: string;
  statusValue: UnitStatus;
  pricingPlanId: string | null;
  pricingPlanName: string;
  canDelete: boolean;
  canReserve: boolean;
  canUnreserve: boolean;
};
type PricingPlanRow = {
  id: string;
  name: string;
  price: number;
  currency: string;
  initialDeposit: number | null;
  paymentDurationMonths: number | null;
  unitsCount: number;
};

type ActionResult = { ok: true } | { ok: false; error: string };
const initial: ActionResult | null = null;

export function ProjectUnitsWorkspace({
  tenantSlug,
  projectId,
  projectName,
  canManage,
  suggestedLabels,
  units,
  pricingPlans,
  currencies,
  defaultCurrency,
}: {
  tenantSlug: string;
  projectId: string;
  projectName: string;
  canManage: boolean;
  suggestedLabels: string[];
  units: UnitRow[];
  pricingPlans: PricingPlanRow[];
  currencies: string[];
  defaultCurrency: string;
}) {
  const [activeTab, setActiveTab] = useState<"units" | "pricing">("units");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitRow | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<UnitRow | null>(null);
  const [reservingUnit, setReservingUnit] = useState<UnitRow | null>(null);
  const [unreservingUnit, setUnreservingUnit] = useState<UnitRow | null>(null);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PricingPlanRow | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<PricingPlanRow | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createPending, startCreateTransition] = useTransition();
  const [editState, editAction, editPending] = useActionState(
    updateUnit.bind(null, tenantSlug, projectId, editingUnit?.id ?? ""),
    initial,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteUnit.bind(null, tenantSlug, projectId, deletingUnit?.id ?? ""),
    initial,
  );
  const [reserveState, reserveAction, reservePending] = useActionState(
    reserveUnit.bind(null, tenantSlug, projectId, reservingUnit?.id ?? ""),
    initial,
  );
  const [unreserveState, unreserveAction, unreservePending] = useActionState(
    unreserveUnit.bind(null, tenantSlug, projectId, unreservingUnit?.id ?? ""),
    initial,
  );
  const [pricingState, pricingAction, pricingPending] = useActionState(
    createPricingPlan.bind(null, tenantSlug, projectId),
    initial,
  );
  const [editPlanState, editPlanAction, editPlanPending] = useActionState(
    updatePricingPlan.bind(null, tenantSlug, projectId, editingPlan?.id ?? ""),
    initial,
  );
  const [deletePlanState, deletePlanAction, deletePlanPending] = useActionState(
    deletePricingPlan.bind(null, tenantSlug, projectId, deletingPlan?.id ?? ""),
    initial,
  );
  const [editErrors, setEditErrors] = useState<{ label?: string }>({});
  const { showSnackbar } = useSnackbar();
  const router = useRouter();
  const editFormRef = useRef<HTMLFormElement | null>(null);
  const pricingFormRef = useRef<HTMLFormElement | null>(null);
  const editPlanFormRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!editState) return;
    if (editState.ok) {
      showSnackbar("Unit updated successfully.", "success");
      setEditingUnit(null);
      setEditErrors({});
    } else {
      showSnackbar(editState.error, "error");
    }
  }, [editState, showSnackbar]);

  useEffect(() => {
    if (!deleteState) return;
    if (deleteState.ok) {
      showSnackbar("Unit deleted successfully.", "success");
      setDeletingUnit(null);
    } else {
      showSnackbar(deleteState.error, "error");
    }
  }, [deleteState, showSnackbar]);

  useEffect(() => {
    if (!reserveState) return;
    if (reserveState.ok) {
      showSnackbar("Unit reserved successfully.", "success");
      setReservingUnit(null);
    } else {
      showSnackbar(reserveState.error, "error");
    }
  }, [reserveState, showSnackbar]);

  useEffect(() => {
    if (!unreserveState) return;
    if (unreserveState.ok) {
      showSnackbar("Unit unreserved successfully.", "success");
      setUnreservingUnit(null);
    } else {
      showSnackbar(unreserveState.error, "error");
    }
  }, [showSnackbar, unreserveState]);

  useEffect(() => {
    if (!pricingState) return;
    if (pricingState.ok) {
      showSnackbar("Pricing plan added successfully.", "success");
      pricingFormRef.current?.reset();
      setIsPricingOpen(false);
    } else {
      showSnackbar(pricingState.error, "error");
    }
  }, [pricingState, showSnackbar]);

  useEffect(() => {
    if (!editPlanState) return;
    if (editPlanState.ok) {
      showSnackbar("Pricing plan updated successfully.", "success");
      setEditingPlan(null);
    } else {
      showSnackbar(editPlanState.error, "error");
    }
  }, [editPlanState, showSnackbar]);

  useEffect(() => {
    if (!deletePlanState) return;
    if (deletePlanState.ok) {
      showSnackbar("Pricing plan deleted.", "success");
      setDeletingPlan(null);
    } else {
      showSnackbar(deletePlanState.error, "error");
    }
  }, [deletePlanState, showSnackbar]);

  function submitCreateUnits(formData: FormData) {
    setCreateError(null);
    startCreateTransition(async () => {
      const isBulk = formData.has("labels");
      const res = isBulk
        ? await createUnitsBulk(tenantSlug, projectId, null, formData)
        : await createUnit(tenantSlug, projectId, null, formData);
      if (res.ok) {
        const count = "count" in res && typeof res.count === "number" ? res.count : 1;
        showSnackbar(count > 1 ? `${count} units added.` : "Unit added successfully.", "success");
        setIsCreateOpen(false);
        router.refresh();
      } else {
        setCreateError(res.error);
        showSnackbar(res.error, "error");
      }
    });
  }

  function submitEditUnit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const label = String(formData.get("label") ?? "").trim();
    if (!label) {
      setEditErrors({ label: "Unit label is required." });
      return;
    }
    setEditErrors({});
    editAction(formData);
  }

  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Project units</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">{projectName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${tenantSlug}/projects`}
            className="rounded-md border border-foreground/15 px-3 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
          >
            Back to projects
          </Link>
          {canManage ? (
            <button
              type="button"
              onClick={() => {
                setActiveTab("pricing");
                setIsPricingOpen(true);
              }}
              className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/[0.06]"
            >
              Add pricing plan
            </button>
          ) : null}
          {canManage ? (
            <button
              type="button"
              onClick={() => {
                setActiveTab("units");
                setIsCreateOpen(true);
              }}
              className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              Add unit
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-5 border-b border-foreground/10">
        <div className="flex gap-5">
          <button
            type="button"
            onClick={() => setActiveTab("units")}
            className={["relative py-2 text-sm font-medium", activeTab === "units" ? "text-foreground" : "text-muted"].join(" ")}
          >
            Units ({units.length})
            <span className={["absolute -bottom-px left-0 h-0.5 w-full", activeTab === "units" ? "bg-foreground" : "bg-transparent"].join(" ")} />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pricing")}
            className={["relative py-2 text-sm font-medium", activeTab === "pricing" ? "text-foreground" : "text-muted"].join(" ")}
          >
            Pricing plans ({pricingPlans.length})
            <span className={["absolute -bottom-px left-0 h-0.5 w-full", activeTab === "pricing" ? "bg-foreground" : "bg-transparent"].join(" ")} />
          </button>
        </div>
      </div>

      {activeTab === "pricing" ? (
        <section className="mt-5 overflow-hidden rounded-lg border border-foreground/10">
          {pricingPlans.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No pricing plans yet. Add one to support multiple offers.</p>
          ) : (
            <div className="divide-y divide-foreground/10">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto] sm:items-center"
                >
                  <p className="font-medium text-foreground">{plan.name}</p>
                  <p className="text-muted">
                    {plan.currency} {plan.price.toLocaleString()}
                  </p>
                  <p className="text-muted">
                    Deposit:{" "}
                    {plan.initialDeposit != null ? `${plan.currency} ${plan.initialDeposit.toLocaleString()}` : "—"}
                  </p>
                  <p className="text-muted">
                    Duration: {plan.paymentDurationMonths != null ? `${plan.paymentDurationMonths} months` : "—"}
                  </p>
                  {canManage ? (
                    <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setEditingPlan(plan)}
                        className="text-xs font-semibold text-foreground underline decoration-foreground/30 underline-offset-2"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingPlan(plan)}
                        className="text-xs font-semibold text-error underline decoration-error/30 underline-offset-2"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
      <div className="mt-5 overflow-hidden rounded-lg border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Purpose</th>
              <th className="px-4 py-3">Layout</th>
              <th className="px-4 py-3">Pricing plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {units.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-sm text-muted">
                  No units yet.
                </td>
              </tr>
            ) : (
              units.map((unit) => (
                <tr key={unit.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{unit.label}</td>
                  <td className="px-4 py-3 text-foreground/90">{unit.purpose}</td>
                  <td className="px-4 py-3 text-muted">{unit.unitType}</td>
                  <td className="px-4 py-3 text-muted">{unit.pricingPlanName}</td>
                  <td className="px-4 py-3 text-foreground/90">{unit.status}</td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setReservingUnit(unit)}
                          disabled={!unit.canReserve}
                          className="text-xs text-foreground underline decoration-foreground/30 underline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Reserve
                        </button>
                        <button
                          type="button"
                          onClick={() => setUnreservingUnit(unit)}
                          disabled={!unit.canUnreserve}
                          className="text-xs text-foreground underline decoration-foreground/30 underline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Unreserve
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingUnit(unit)}
                          className="text-xs text-muted underline decoration-foreground/20 underline-offset-2 hover:text-foreground"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingUnit(unit)}
                          className="text-xs text-error underline decoration-error/40 underline-offset-2"
                          disabled={!unit.canDelete}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      <AddUnitsModal
        open={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setCreateError(null);
        }}
        projectName={projectName}
        existingLabels={units.map((u) => u.label)}
        suggestedLabels={suggestedLabels}
        pricingPlans={pricingPlans.map((p) => ({ id: p.id, name: p.name }))}
        pending={createPending}
        error={createError}
        onSubmit={submitCreateUnits}
      />

      {editingUnit ? (
        <ModalOverlay open onClose={() => setEditingUnit(null)} panelClassName={MODAL_PANEL_XL}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Edit unit</h2>
              <button
                type="button"
                onClick={() => setEditingUnit(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <form ref={editFormRef} noValidate onSubmit={submitEditUnit} className="mt-4 space-y-4">
              {editState && !editState.ok ? <FormAlert>{editState.error}</FormAlert> : null}
              <div>
                <label htmlFor="unit-edit-label" className="mb-1 block text-sm text-muted">
                  Unit label
                </label>
                <input
                  id="unit-edit-label"
                  name="label"
                  defaultValue={editingUnit.label}
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
                {editErrors.label ? <FormFieldError>{editErrors.label}</FormFieldError> : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="unit-edit-purpose" className="mb-1 block text-sm text-muted">
                    Purpose
                  </label>
                  <UiSelect id="unit-edit-purpose" name="purpose" defaultValue={editingUnit.purposeValue}>
                    <option value={UnitPurpose.SALE}>For sale</option>
                    <option value={UnitPurpose.SHORT_LET}>Short let</option>
                    <option value={UnitPurpose.RENTAL}>Rental</option>
                    <option value={UnitPurpose.HOSTEL}>Hostel</option>
                  </UiSelect>
                </div>
                <div>
                  <label htmlFor="unit-edit-status" className="mb-1 block text-sm text-muted">
                    Status
                  </label>
                  <UiSelect id="unit-edit-status" name="status" defaultValue={editingUnit.statusValue}>
                    <option value={UnitStatus.AVAILABLE}>Available</option>
                    <option value={UnitStatus.UNDER_CONSTRUCTION}>Under Construction</option>
                    <option value={UnitStatus.RESERVED}>Reserved</option>
                    <option value={UnitStatus.SOLD}>Sold</option>
                  </UiSelect>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="unit-edit-type" className="mb-1 block text-sm text-muted">
                    Layout (optional)
                  </label>
                  <input
                    id="unit-edit-type"
                    name="unitType"
                    defaultValue={editingUnit.unitType === "Unspecified" ? "" : editingUnit.unitType}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label htmlFor="unit-edit-pricing-plan" className="mb-1 block text-sm text-muted">
                    Pricing plan (optional)
                  </label>
                  <UiSelect
                    id="unit-edit-pricing-plan"
                    name="pricingPlanId"
                    defaultValue={editingUnit.pricingPlanId ?? ""}
                  >
                    <option value="">No plan</option>
                    {pricingPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </UiSelect>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUnit(null)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editPending}
                  aria-busy={editPending}
                  className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {editPending ? <ButtonSpinner /> : null}
                  {editPending ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
        </ModalOverlay>
      ) : null}

      {deletingUnit ? (
        <ModalOverlay open onClose={() => setDeletingUnit(null)} panelClassName={MODAL_PANEL_SM}>
            <h2 className="text-lg font-semibold text-foreground">Delete unit?</h2>
            <p className="mt-2 text-sm text-muted">
              This will permanently remove <strong className="text-foreground">{deletingUnit.label}</strong>.
            </p>
            {!deletingUnit.canDelete ? (
              <p className="mt-2 text-sm text-error">
                This unit cannot be deleted if it is reserved, sold, or linked to a deal.
              </p>
            ) : null}
            {deleteState && !deleteState.ok ? <FormAlert>{deleteState.error}</FormAlert> : null}
            <form action={deleteAction} className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingUnit(null)}
                className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={deletePending || !deletingUnit.canDelete}
                aria-busy={deletePending}
                className="inline-flex items-center gap-2 rounded-md border border-error bg-error px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {deletePending ? <ButtonSpinner /> : null}
                {deletePending ? "Deleting..." : "Delete"}
              </button>
            </form>
        </ModalOverlay>
      ) : null}

      {reservingUnit ? (
        <ModalOverlay open onClose={() => setReservingUnit(null)} panelClassName={MODAL_PANEL_SM}>
            <h2 className="text-lg font-semibold text-foreground">Reserve unit?</h2>
            <p className="mt-2 text-sm text-muted">
              Reserve <strong className="text-foreground">{reservingUnit.label}</strong> for deal creation. This is
              atomic and will fail if another user reserves first.
            </p>
            {!reservingUnit.canReserve ? (
              <p className="mt-2 text-sm text-error">Only available units can be reserved.</p>
            ) : null}
            {reserveState && !reserveState.ok ? <FormAlert>{reserveState.error}</FormAlert> : null}
            <form action={reserveAction} className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReservingUnit(null)}
                className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reservePending || !reservingUnit.canReserve}
                aria-busy={reservePending}
                className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {reservePending ? <ButtonSpinner /> : null}
                {reservePending ? "Reserving..." : "Reserve unit"}
              </button>
            </form>
        </ModalOverlay>
      ) : null}

      {unreservingUnit ? (
        <ModalOverlay open onClose={() => setUnreservingUnit(null)} panelClassName={MODAL_PANEL_SM}>
            <h2 className="text-lg font-semibold text-foreground">Unreserve unit?</h2>
            <p className="mt-2 text-sm text-muted">
              This will return <strong className="text-foreground">{unreservingUnit.label}</strong> to available.
            </p>
            {!unreservingUnit.canUnreserve ? (
              <p className="mt-2 text-sm text-error">Only reserved units can be unreserved.</p>
            ) : null}
            {unreserveState && !unreserveState.ok ? <FormAlert>{unreserveState.error}</FormAlert> : null}
            <form action={unreserveAction} className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUnreservingUnit(null)}
                className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={unreservePending || !unreservingUnit.canUnreserve}
                aria-busy={unreservePending}
                className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {unreservePending ? <ButtonSpinner /> : null}
                {unreservePending ? "Unreserving..." : "Unreserve"}
              </button>
            </form>
        </ModalOverlay>
      ) : null}

      <ModalOverlay open={Boolean(isPricingOpen)} onClose={() => setIsPricingOpen(false)} panelClassName={MODAL_PANEL_XL}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Add pricing plan</h2>
              <button
                type="button"
                onClick={() => setIsPricingOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <form ref={pricingFormRef} action={pricingAction} className="mt-4 space-y-3">
              {pricingState && !pricingState.ok ? <FormAlert>{pricingState.error}</FormAlert> : null}
              <div>
                <label htmlFor="plan-name" className="mb-1 block text-sm text-muted">
                  Plan name
                </label>
                <input
                  id="plan-name"
                  name="name"
                  placeholder="e.g. Studio Unit (17SQM)"
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="plan-price" className="mb-1 block text-sm text-muted">
                    Price
                  </label>
                  <input
                    id="plan-price"
                    name="price"
                    inputMode="decimal"
                    placeholder="70000000"
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label htmlFor="plan-currency" className="mb-1 block text-sm text-muted">
                    Currency
                  </label>
                  <CurrencySelect
                    id="plan-currency"
                    currencies={currencies}
                    defaultCurrency={defaultCurrency}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="plan-deposit" className="mb-1 block text-sm text-muted">
                    Initial deposit (optional)
                  </label>
                  <input
                    id="plan-deposit"
                    name="initialDeposit"
                    inputMode="decimal"
                    placeholder="20000000"
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label htmlFor="plan-duration" className="mb-1 block text-sm text-muted">
                    Duration (months)
                  </label>
                  <input
                    id="plan-duration"
                    name="paymentDurationMonths"
                    inputMode="numeric"
                    placeholder="15"
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsPricingOpen(false)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pricingPending}
                  aria-busy={pricingPending}
                  className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {pricingPending ? <ButtonSpinner /> : null}
                  {pricingPending ? "Saving..." : "Save plan"}
                </button>
              </div>
            </form>
      </ModalOverlay>

      {editingPlan ? (
        <ModalOverlay open onClose={() => setEditingPlan(null)} panelClassName={MODAL_PANEL_XL}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Edit pricing plan</h2>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <form ref={editPlanFormRef} action={editPlanAction} className="mt-4 space-y-3">
              {editPlanState && !editPlanState.ok ? <FormAlert>{editPlanState.error}</FormAlert> : null}
              <div>
                <label htmlFor="plan-edit-name" className="mb-1 block text-sm text-muted">
                  Plan name
                </label>
                <input
                  id="plan-edit-name"
                  name="name"
                  defaultValue={editingPlan.name}
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="plan-edit-price" className="mb-1 block text-sm text-muted">
                    Price
                  </label>
                  <input
                    id="plan-edit-price"
                    name="price"
                    inputMode="decimal"
                    defaultValue={String(editingPlan.price)}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label htmlFor="plan-edit-currency" className="mb-1 block text-sm text-muted">
                    Currency
                  </label>
                  <CurrencySelect
                    id="plan-edit-currency"
                    currencies={currencies}
                    defaultCurrency={defaultCurrency}
                    defaultValue={editingPlan.currency}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="plan-edit-deposit" className="mb-1 block text-sm text-muted">
                    Initial deposit (optional)
                  </label>
                  <input
                    id="plan-edit-deposit"
                    name="initialDeposit"
                    inputMode="decimal"
                    defaultValue={editingPlan.initialDeposit != null ? String(editingPlan.initialDeposit) : ""}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label htmlFor="plan-edit-duration" className="mb-1 block text-sm text-muted">
                    Duration (months)
                  </label>
                  <input
                    id="plan-edit-duration"
                    name="paymentDurationMonths"
                    inputMode="numeric"
                    defaultValue={
                      editingPlan.paymentDurationMonths != null ? String(editingPlan.paymentDurationMonths) : ""
                    }
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editPlanPending}
                  aria-busy={editPlanPending}
                  className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {editPlanPending ? <ButtonSpinner /> : null}
                  {editPlanPending ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
        </ModalOverlay>
      ) : null}

      {deletingPlan ? (
        <ModalOverlay open onClose={() => setDeletingPlan(null)} panelClassName={MODAL_PANEL_SM}>
            <h2 className="text-lg font-semibold text-foreground">Delete pricing plan?</h2>
            <p className="mt-2 text-sm text-muted">
              This will remove <strong className="text-foreground">{deletingPlan.name}</strong>.
              {deletingPlan.unitsCount > 0 ? (
                <>
                  {" "}
                  {deletingPlan.unitsCount} unit{deletingPlan.unitsCount === 1 ? "" : "s"} linked to this plan will
                  show as having no plan.
                </>
              ) : null}
            </p>
            {deletePlanState && !deletePlanState.ok ? <FormAlert>{deletePlanState.error}</FormAlert> : null}
            <form action={deletePlanAction} className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingPlan(null)}
                className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={deletePlanPending}
                aria-busy={deletePlanPending}
                className="inline-flex items-center gap-2 rounded-md border border-error bg-error px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {deletePlanPending ? <ButtonSpinner /> : null}
                {deletePlanPending ? "Deleting..." : "Delete plan"}
              </button>
            </form>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
