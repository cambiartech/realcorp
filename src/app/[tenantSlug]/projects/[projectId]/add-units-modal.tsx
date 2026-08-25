"use client";

import { useEffect, useMemo, useState } from "react";
import { UnitPurpose, UnitStatus } from "@/generated/prisma";
import { UNIT_PURPOSE_OPTIONS } from "@/lib/ui-format";
import { ModalOverlay } from "@/components/modal-overlay";
import { FormAlert } from "@/components/form-message";
import { UiSelect } from "@/components/ui-select";
import { ButtonSpinner } from "@/components/button-spinner";
import { MODAL_PANEL_XL } from "@/lib/modal-panel";
import { generateBulkUnitLabels } from "@/lib/unit-label-suggestions";
import { clientDisplayNameFromUnitLabel } from "@/lib/unit-label-client-import";

type PricingPlanOption = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  projectName: string;
  existingLabels: string[];
  suggestedLabels: string[];
  pricingPlans: PricingPlanOption[];
  pending: boolean;
  error: string | null;
  onSubmit: (formData: FormData) => void;
  projectServiceFee?: number | null;
  currency?: string;
};

export function AddUnitsModal({
  open,
  onClose,
  projectName,
  existingLabels,
  suggestedLabels,
  pricingPlans,
  pending,
  error,
  onSubmit,
  projectServiceFee,
  currency,
}: Props) {
  const [quantity, setQuantity] = useState(1);
  const [namingMode, setNamingMode] = useState<"sequential" | "custom">("sequential");
  const [baseLabel, setBaseLabel] = useState("");
  const [pricingPlanId, setPricingPlanId] = useState("");
  const [purpose, setPurpose] = useState<UnitPurpose>(UnitPurpose.SALE);
  const [status, setStatus] = useState<UnitStatus>(UnitStatus.AVAILABLE);
  const [unitType, setUnitType] = useState("");
  const [customLabels, setCustomLabels] = useState<string[]>([""]);
  const [importAsClient, setImportAsClient] = useState(true);
  const [serviceFee, setServiceFee] = useState("");

  const selectedPlan = pricingPlans.find((p) => p.id === pricingPlanId);

  useEffect(() => {
    if (!open) return;
    setQuantity(1);
    setNamingMode("sequential");
    setBaseLabel(suggestedLabels[0] ?? "");
    setPricingPlanId("");
    setPurpose(UnitPurpose.SALE);
    setStatus(UnitStatus.AVAILABLE);
    setUnitType("");
    setCustomLabels([""]);
    setImportAsClient(true);
    setServiceFee("");
  }, [open, suggestedLabels]);

  useEffect(() => {
    if (namingMode === "custom") {
      setCustomLabels((prev) => {
        const next = [...prev];
        while (next.length < quantity) next.push("");
        return next.slice(0, quantity);
      });
    }
  }, [quantity, namingMode]);

  const previewLabels = useMemo(() => {
    if (namingMode === "custom") {
      return customLabels.map((l) => l.trim()).filter(Boolean);
    }
    if (quantity <= 1) {
      const single = baseLabel.trim() || suggestedLabels[0] || "";
      return single ? [single] : [];
    }
    return generateBulkUnitLabels({
      count: quantity,
      existingLabels,
      baseLabel: baseLabel.trim() || undefined,
      pricingPlanName: !baseLabel.trim() ? selectedPlan?.name : undefined,
      projectName,
    });
  }, [
    namingMode,
    customLabels,
    quantity,
    baseLabel,
    existingLabels,
    selectedPlan?.name,
    projectName,
    suggestedLabels,
  ]);

  const importableClientNames = useMemo(() => {
    const names = previewLabels
      .map((label) => clientDisplayNameFromUnitLabel(label, projectName))
      .filter((name): name is string => Boolean(name));
    return [...new Set(names)];
  }, [previewLabels, projectName]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("purpose", purpose);
    fd.set("status", status);
    if (unitType.trim()) fd.set("unitType", unitType.trim());
    if (pricingPlanId) fd.set("pricingPlanId", pricingPlanId);
    if (serviceFee.trim()) fd.set("serviceFee", serviceFee.trim());
    if (importAsClient) fd.set("importAsClient", "1");

    if (quantity === 1 && namingMode === "sequential") {
      const label = (baseLabel.trim() || suggestedLabels[0] || "").trim();
      if (!label) return;
      fd.set("label", label);
      onSubmit(fd);
      return;
    }

    const labels =
      namingMode === "custom" ? customLabels.map((l) => l.trim()).filter(Boolean) : previewLabels;
    if (labels.length === 0) return;
    fd.set("labels", JSON.stringify(labels));
    onSubmit(fd);
  }

  const isBulk = quantity > 1 || namingMode === "custom";
  const customIncomplete = namingMode === "custom" && customLabels.some((l) => !l.trim());

  return (
    <ModalOverlay open={open} onClose={onClose} panelClassName={MODAL_PANEL_XL}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{quantity > 1 ? "Add units" : "Add unit"}</h2>
          <p className="mt-0.5 text-xs text-muted">
            Add one or many units with the same purpose, status, and pricing plan.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06]"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {error ? <FormAlert>{error}</FormAlert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-muted">
            How many units?
            <input
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={(e) => setQuantity(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
              className="mt-1 w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
            />
          </label>
          {quantity > 1 ? (
            <label className="text-sm text-muted">
              Naming
              <UiSelect
                className="mt-1"
                value={namingMode}
                onChange={(e) => setNamingMode(e.target.value as "sequential" | "custom")}
              >
                <option value="sequential">Auto sequential names</option>
                <option value="custom">Enter each name</option>
              </UiSelect>
            </label>
          ) : null}
        </div>

        {quantity === 1 || namingMode === "sequential" ? (
          <div>
            <label className="mb-1 block text-sm text-muted">
              {quantity > 1 ? "Name pattern (first unit)" : "Unit label"}
            </label>
            <input
              value={baseLabel}
              onChange={(e) => setBaseLabel(e.target.value)}
              placeholder={suggestedLabels[0] ? `e.g. ${suggestedLabels[0]}` : "e.g. Block A 01"}
              className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground placeholder:text-muted"
            />
            {suggestedLabels.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestedLabels.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setBaseLabel(label)}
                    className="rounded-md border border-foreground/15 bg-background px-2 py-1 text-xs hover:bg-foreground/[0.06]"
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            {quantity > 1 ? (
              <p className="mt-2 text-xs text-muted">
                Leave blank to use the pricing plan name, or enter a prefix like &quot;One bedroom&quot; → One
                bedroom 01, 02, 03…
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted">Unit names</p>
            {customLabels.map((label, i) => (
              <input
                key={i}
                value={label}
                onChange={(e) =>
                  setCustomLabels((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                }
                placeholder={`Unit ${i + 1}`}
                className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm"
                required
              />
            ))}
          </div>
        )}

        {previewLabels.length > 0 && namingMode === "sequential" && quantity > 1 ? (
          <div className="rounded-md border border-foreground/10 bg-foreground/[0.02] px-3 py-2">
            <p className="text-xs font-medium text-foreground">Preview ({previewLabels.length} units)</p>
            <p className="mt-1 text-xs text-muted">{previewLabels.join(" · ")}</p>
            <p className="mt-1 text-xs text-muted">After save, the unit list stays in this numbered order.</p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-muted">
            Purpose
            <UiSelect
              className="mt-1"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as UnitPurpose)}
            >
              {UNIT_PURPOSE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </UiSelect>
          </label>
          <label className="text-sm text-muted">
            Status
            <UiSelect
              className="mt-1"
              value={status}
              onChange={(e) => setStatus(e.target.value as UnitStatus)}
            >
              <option value={UnitStatus.AVAILABLE}>Available</option>
              <option value={UnitStatus.UNDER_CONSTRUCTION}>Under Construction</option>
              <option value={UnitStatus.RESERVED}>Reserved</option>
              <option value={UnitStatus.SOLD}>Sold</option>
            </UiSelect>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-muted">
            Layout (optional)
            <input
              value={unitType}
              onChange={(e) => setUnitType(e.target.value)}
              placeholder="e.g. 3 Bedroom Duplex"
              className="mt-1 w-full border border-foreground/15 bg-field px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-muted">
            Pricing plan (optional)
            <UiSelect
              className="mt-1"
              value={pricingPlanId}
              onChange={(e) => setPricingPlanId(e.target.value)}
            >
              <option value="">No plan</option>
              {pricingPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </UiSelect>
          </label>
        </div>

        <label className="text-sm text-muted">
          Service fee (optional)
          <input
            type="number"
            min="0"
            step="0.01"
            value={serviceFee}
            onChange={(e) => setServiceFee(e.target.value)}
            placeholder={
              projectServiceFee != null
                ? `Leave blank to use project fee (${currency || "NGN"} ${projectServiceFee.toLocaleString()})`
                : "Amount charged for these units"
            }
            className="mt-1 w-full border border-foreground/15 bg-field px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-muted">
            Estate / management fee. Track payments from the client record. This does not change the sale
            price.
          </span>
        </label>

        <label className="flex items-start gap-2 rounded-md border border-foreground/10 bg-foreground/[0.02] px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={importAsClient}
            onChange={(e) => setImportAsClient(e.target.checked)}
          />
          <span>
            <span className="font-medium text-foreground">Also add as client</span>
            <span className="mt-0.5 block text-xs text-muted">
              If the label includes a person&apos;s name, create or reuse that client and assign this unit — including
              rental, short-let, and sale. No need to re-enter them under Clients.
              {importableClientNames.length
                ? ` Preview: ${importableClientNames.slice(0, 4).join(", ")}${importableClientNames.length > 4 ? "…" : ""}.`
                : " Labels without a name stay as units only."}
            </span>
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-foreground/15 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || previewLabels.length === 0 || customIncomplete}
            className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            {pending ? <ButtonSpinner /> : null}
            {pending ? "Adding…" : isBulk ? `Add ${previewLabels.length} units` : "Add unit"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
