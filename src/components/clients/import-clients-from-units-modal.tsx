"use client";

import { useEffect, useMemo, useState } from "react";
import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_2XL } from "@/lib/modal-panel";
import { ButtonSpinner } from "@/components/button-spinner";
import { UiSelect } from "@/components/ui-select";
import { UNIT_NAME_PATTERN_PRESETS, type UnitNamePatternPresetId } from "@/lib/unit-label-client-import";
import {
  importClientsFromUnitLabels,
  previewClientsFromUnitLabels,
  type UnitLabelImportPreviewGroup,
} from "@/app/[tenantSlug]/clients/actions";

export function ImportClientsFromUnitsModal({
  tenantSlug,
  projectId,
  open,
  onClose,
  onImported,
}: {
  tenantSlug: string;
  projectId?: string;
  open: boolean;
  onClose: () => void;
  onImported: (summary: string) => void;
}) {
  const [preset, setPreset] = useState<UnitNamePatternPresetId>("room_then_name");
  const [pattern, setPattern] = useState("RM {room} {name}");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skippedNoName, setSkippedNoName] = useState(0);
  const [skippedAlreadyLinked, setSkippedAlreadyLinked] = useState(0);
  const [unitsScanned, setUnitsScanned] = useState(0);
  const [groups, setGroups] = useState<UnitLabelImportPreviewGroup[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void previewClientsFromUnitLabels(tenantSlug, projectId ? { projectId } : undefined).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        setGroups([]);
        return;
      }
      setPreset(result.preset);
      setPattern(result.pattern);
      setUnitsScanned(result.unitsScanned);
      setSkippedNoName(result.skippedNoName);
      setSkippedAlreadyLinked(result.skippedAlreadyLinked);
      setGroups(result.groups);
      setSelected(Object.fromEntries(result.groups.map((group) => [group.key, group.defaultSelected])));
    });
    return () => {
      cancelled = true;
    };
  }, [open, tenantSlug, projectId]);

  const selectedGroups = useMemo(
    () => groups.filter((group) => selected[group.key]),
    [groups, selected],
  );
  const selectedUnitCount = selectedGroups.reduce((sum, group) => sum + group.units.length, 0);

  async function refreshPreview(nextPreset: UnitNamePatternPresetId, nextPattern: string) {
    setLoading(true);
    setError(null);
    const result = await previewClientsFromUnitLabels(tenantSlug, {
      preset: nextPreset,
      pattern: nextPattern,
      projectId,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      setGroups([]);
      return;
    }
    setUnitsScanned(result.unitsScanned);
    setSkippedNoName(result.skippedNoName);
    setSkippedAlreadyLinked(result.skippedAlreadyLinked);
    setGroups(result.groups);
    setSelected(Object.fromEntries(result.groups.map((group) => [group.key, group.defaultSelected])));
  }

  async function handleImport() {
    if (!selectedGroups.length || importing) return;
    setImporting(true);
    setError(null);
    const result = await importClientsFromUnitLabels(tenantSlug, {
      preset,
      pattern,
      selectedKeys: selectedGroups.map((group) => group.key),
      projectId,
    });
    setImporting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const parts = [
      result.created ? `${result.created} new client${result.created === 1 ? "" : "s"}` : null,
      result.reused ? `${result.reused} already on file` : null,
      result.unitsLinked ? `${result.unitsLinked} unit${result.unitsLinked === 1 ? "" : "s"} assigned` : null,
    ].filter(Boolean);
    onImported(parts.join(" · ") || "Import complete.");
    onClose();
  }

  if (!open) return null;

  return (
    <ModalOverlay open onClose={onClose} panelClassName={MODAL_PANEL_2XL} aria-labelledby="import-units-title">
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-foreground/10 px-6 py-4">
          <h2 id="import-units-title" className="text-lg font-semibold text-foreground">
            Import clients from unit names
            {projectId ? " in this project" : ""}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Tell us how unit labels are written. We extract the person from sale, rental, short-let, and hostel
            units, skip blanks, and assign every matching unit to that client — without creating duplicates.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Naming pattern</span>
              <UiSelect
                value={preset}
                onChange={(e) => {
                  const next = (e.target.value as UnitNamePatternPresetId) || "room_then_name";
                  const nextPattern =
                    UNIT_NAME_PATTERN_PRESETS.find((item) => item.id === next)?.pattern || pattern;
                  setPreset(next);
                  setPattern(nextPattern);
                  void refreshPreview(next, nextPattern);
                }}
              >
                {UNIT_NAME_PATTERN_PRESETS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </UiSelect>
              <p className="text-xs text-muted">
                Example: {UNIT_NAME_PATTERN_PRESETS.find((item) => item.id === preset)?.example}
              </p>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                {preset === "custom" ? "Your pattern" : "Pattern"}
              </span>
              <input
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                onBlur={() => void refreshPreview(preset, pattern)}
                disabled={preset !== "custom"}
                className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground disabled:opacity-60"
                placeholder="RM {room} {name}"
              />
              <p className="text-xs text-muted">
                Use {"{name}"} for the client and {"{room}"} for the unit number.
              </p>
            </label>
          </div>

          <p className="mt-4 text-xs text-muted">
            Scanned {unitsScanned} unit{unitsScanned === 1 ? "" : "s"}
            {skippedAlreadyLinked ? ` · ${skippedAlreadyLinked} already assigned` : ""}
            {skippedNoName ? ` · ${skippedNoName} had no name in the label` : ""}
            {loading ? " · Updating preview…" : ""}
          </p>

          {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}

          {groups.length === 0 && !loading ? (
            <p className="mt-6 text-sm text-muted">
              No client names matched this pattern. Try another pattern, or check that unit labels include the
              person&apos;s name.
            </p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-foreground/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={groups.length > 0 && selectedGroups.length === groups.length}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setSelected(Object.fromEntries(groups.map((group) => [group.key, next])));
                        }}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Units / projects</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {groups.map((group) => (
                    <tr key={group.key} className={group.warning ? "bg-[var(--warn-wash)]/40" : ""}>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          checked={Boolean(selected[group.key])}
                          onChange={(e) =>
                            setSelected((prev) => ({ ...prev, [group.key]: e.target.checked }))
                          }
                          aria-label={`Select ${group.fullName}`}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <p className="font-medium text-foreground">{group.fullName}</p>
                        {group.warning ? <p className="mt-0.5 text-xs text-muted">{group.warning}</p> : null}
                      </td>
                      <td className="px-3 py-2 align-top text-muted">
                        {group.units.map((unit) => (
                          <p key={unit.id} className="text-xs">
                            {unit.label} · {unit.projectName}
                          </p>
                        ))}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-muted">
                        {group.existingClientName
                          ? `Already a client — add ${group.units.length} unit${group.units.length === 1 ? "" : "s"} as owner`
                          : group.suggestedStatus === "ACTIVE"
                            ? "Owner · Active"
                            : "Owner · Prospect (reserved, not completed)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-foreground/10 px-6 py-4">
          <p className="text-xs text-muted">
            {selectedGroups.length} client{selectedGroups.length === 1 ? "" : "s"} · {selectedUnitCount} unit
            {selectedUnitCount === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={importing || loading || selectedGroups.length === 0}
              onClick={() => void handleImport()}
              className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {importing ? <ButtonSpinner /> : null}
              {importing ? "Importing…" : "Import selected"}
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}
