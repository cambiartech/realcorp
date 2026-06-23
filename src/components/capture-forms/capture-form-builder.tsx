"use client";

import type { CaptureFormField, CaptureFormFieldType } from "@/lib/capture-form-types";
import {
  CAPTURE_FIELD_TYPE_LABELS,
  slugifyFieldKey,
} from "@/lib/capture-form-templates";
import { UiSelect } from "@/components/ui-select";
import { TagsInput } from "@/components/tags-input";

const PALETTE: CaptureFormFieldType[] = [
  "name",
  "email",
  "phone",
  "text",
  "textarea",
  "select",
  "number",
  "project_interest",
  "budget_range",
];

function defaultFieldForType(type: CaptureFormFieldType, index: number): CaptureFormField {
  const label = CAPTURE_FIELD_TYPE_LABELS[type];
  const key =
    type === "name"
      ? "name"
      : type === "email"
        ? "email"
        : type === "phone"
          ? "phone"
          : type === "project_interest"
            ? "project_interest"
            : type === "budget_range"
              ? "budget_range"
              : slugifyFieldKey(label, index);
  return {
    key,
    type,
    label,
    required: type === "name" || type === "email",
    halfWidth: type === "phone" || type === "email",
    options: type === "select" ? ["Option 1", "Option 2"] : undefined,
  };
}

export function CaptureFormBuilder({
  fields,
  onChange,
  readOnly = false,
  title,
  description,
}: {
  fields: CaptureFormField[];
  onChange: (fields: CaptureFormField[]) => void;
  readOnly?: boolean;
  title?: string;
  description?: string | null;
}) {
  function update(index: number, patch: Partial<CaptureFormField>) {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function remove(index: number) {
    onChange(fields.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= fields.length) return;
    const copy = [...fields];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    onChange(copy);
  }

  function addType(type: CaptureFormFieldType) {
    onChange([...fields, defaultFieldForType(type, fields.length)]);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {!readOnly ? (
          <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Add field</p>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addType(type)}
                  className="rounded-md border border-foreground/15 bg-background px-2.5 py-1 text-xs font-medium hover:bg-foreground/[0.04]"
                >
                  + {CAPTURE_FIELD_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {fields.length === 0 ? (
          <div className="rounded-lg border border-dashed border-foreground/20 px-6 py-12 text-center text-sm text-muted">
            No fields yet. Pick a template or add fields from the palette above.
          </div>
        ) : (
          fields.map((field, index) => (
            <div key={`${field.key}-${index}`} className="rounded-lg border border-foreground/10 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Field {index + 1} · {CAPTURE_FIELD_TYPE_LABELS[field.type]}
                </span>
                {!readOnly ? (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="text-xs underline disabled:opacity-30">
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === fields.length - 1}
                      className="text-xs underline disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button type="button" onClick={() => remove(index)} className="text-xs text-red-600 underline">
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-muted">Label</label>
                  <input
                    value={field.label}
                    disabled={readOnly}
                    onChange={(e) => {
                      const label = e.target.value;
                      const patch: Partial<CaptureFormField> = { label };
                      if (!readOnly && !["name", "email", "phone", "project_interest", "budget_range"].includes(field.type)) {
                        patch.key = slugifyFieldKey(label, index);
                      }
                      update(index, patch);
                    }}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Field key</label>
                  <input
                    value={field.key}
                    disabled={readOnly || field.type === "name" || field.type === "email"}
                    onChange={(e) => update(index, { key: e.target.value.replace(/\s+/g, "_").toLowerCase() })}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Placeholder</label>
                  <input
                    value={field.placeholder ?? ""}
                    disabled={readOnly}
                    onChange={(e) => update(index, { placeholder: e.target.value || undefined })}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(field.required)}
                      disabled={readOnly}
                      onChange={(e) => update(index, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(field.halfWidth)}
                      disabled={readOnly}
                      onChange={(e) => update(index, { halfWidth: e.target.checked })}
                    />
                    Half width
                  </label>
                </div>
                {field.type === "select" ? (
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs text-muted">Dropdown options</label>
                    <TagsInput
                      value={field.options ?? []}
                      onChange={(options) => update(index, { options })}
                      disabled={readOnly}
                      placeholder="e.g. Investor"
                      hint="Press Enter or click Add. Each option appears as a pill above."
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Live preview</p>
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 shadow-sm">
          {title ? <p className="text-base font-bold text-foreground">{title}</p> : null}
          {description ? (
            <p className="mt-1 line-clamp-3 text-xs text-muted" dangerouslySetInnerHTML={{ __html: description }} />
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key} className={field.halfWidth ? "" : "sm:col-span-2"}>
                <label className="mb-1 block text-[11px] font-medium text-muted">
                  {field.label}
                  {field.required ? " *" : ""}
                </label>
                {field.type === "textarea" ? (
                  <div className="h-16 rounded border border-foreground/15 bg-field/50" />
                ) : field.type === "select" || field.type === "project_interest" ? (
                  <UiSelect disabled value={(field.options ?? [])[0] ?? ""} className="text-xs opacity-100">
                    {(field.options ?? ["Select…"]).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </UiSelect>
                ) : (
                  <div className="rounded border border-foreground/15 bg-field/50 px-2 py-2 text-xs text-muted">
                    {field.placeholder || CAPTURE_FIELD_TYPE_LABELS[field.type]}
                  </div>
                )}
              </div>
            ))}
          </div>
          {fields.length > 0 ? (
            <div className="mt-4 rounded-md bg-foreground py-2 text-center text-xs font-semibold text-background">Submit</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
