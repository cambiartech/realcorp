"use client";

import { useState } from "react";
import { submitManualCaptureForm } from "@/app/[tenantSlug]/marketing/capture-form-actions";
import { ButtonSpinner } from "@/components/button-spinner";
import { FormAlert } from "@/components/form-message";
import { ModalOverlay } from "@/components/modal-overlay";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import type { CaptureFormField } from "@/lib/capture-form-types";
import { MODAL_PANEL_LG } from "@/lib/modal-panel";
import { useRouter } from "next/navigation";

function fieldInputType(type: CaptureFormField["type"]) {
  if (type === "email") return "email";
  if (type === "phone") return "tel";
  if (type === "number") return "number";
  return "text";
}

export function ManualCaptureFormFill({
  tenantSlug,
  formSlug,
  formName,
  formTitle,
  fields,
  projectOptions,
  triggerClassName,
}: {
  tenantSlug: string;
  formSlug: string;
  formName: string;
  formTitle: string;
  fields: CaptureFormField[];
  projectOptions: string[];
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showSnackbar } = useSnackbar();
  const router = useRouter();

  function updateValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function close() {
    if (loading) return;
    setOpen(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await submitManualCaptureForm(tenantSlug, formSlug, values, {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        localHour: new Date().getHours(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setValues({});
      setOpen(false);
      showSnackbar(
        result.heldForMarketing
          ? "Entry saved. It’s waiting in Marketing → Entries."
          : "Entry saved. It’s in Sales → Leads.",
        "success",
      );
      router.refresh();
    } catch {
      setError("Could not save this entry. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!fields.length) {
            showSnackbar("Add fields to this form first.", "error");
            return;
          }
          setOpen(true);
        }}
        className={
          triggerClassName ??
          "inline-flex w-fit rounded-md border border-foreground px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-foreground hover:text-background"
        }
      >
        Manual Entry
      </button>
      <ModalOverlay open={open} onClose={close} panelClassName={MODAL_PANEL_LG}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Fill for someone</h2>
            <p className="mt-1 text-sm text-muted">
              Enter this {formName} form for a caller or walk-in who cannot use their phone. Same fields
              and routing as the live form.
            </p>
            <p className="mt-1 text-xs text-muted">{formTitle}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06]"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 grid gap-3 sm:grid-cols-2">
          {error ? (
            <div className="sm:col-span-2">
              <FormAlert>{error}</FormAlert>
            </div>
          ) : null}
          {fields.map((field) => {
            const col = field.halfWidth ? "" : "sm:col-span-2";
            const common = {
              value: values[field.key] ?? "",
              onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
                updateValue(field.key, e.target.value),
              className:
                "w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20",
              required: field.required,
              placeholder: field.placeholder,
            };

            if (field.type === "textarea") {
              return (
                <div key={field.key} className={col}>
                  <label className="mb-1 block text-sm text-muted">
                    {field.label}
                    {field.required ? " *" : ""}
                  </label>
                  <textarea {...common} rows={3} />
                </div>
              );
            }

            if (field.type === "select") {
              return (
                <div key={field.key} className={col}>
                  <label className="mb-1 block text-sm text-muted">
                    {field.label}
                    {field.required ? " *" : ""}
                  </label>
                  <UiSelect
                    name={field.key}
                    value={common.value}
                    onChange={common.onChange}
                    required={field.required}
                  >
                    <option value="">Select…</option>
                    {(field.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </UiSelect>
                </div>
              );
            }

            if (field.type === "project_interest") {
              return (
                <div key={field.key} className={col}>
                  <label className="mb-1 block text-sm text-muted">
                    {field.label}
                    {field.required ? " *" : ""}
                  </label>
                  <UiSelect
                    name={field.key}
                    value={common.value}
                    onChange={common.onChange}
                    required={field.required}
                  >
                    <option value="">Select project</option>
                    {projectOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </UiSelect>
                </div>
              );
            }

            return (
              <div key={field.key} className={col}>
                <label className="mb-1 block text-sm text-muted">
                  {field.label}
                  {field.required ? " *" : ""}
                </label>
                <input type={fieldInputType(field.type)} name={field.key} {...common} />
              </div>
            );
          })}
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {loading ? <ButtonSpinner /> : null}
              {loading ? "Saving…" : "Save entry"}
            </button>
          </div>
        </form>
      </ModalOverlay>
    </>
  );
}
