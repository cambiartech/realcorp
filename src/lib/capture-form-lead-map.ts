import type { CaptureFormField } from "@/lib/capture-form-types";

const LEAD_COLUMN_KEYS = new Set(["name", "email", "phone", "project_interest", "budget_range"]);

export function resolveLeadNameFromValues(
  fields: CaptureFormField[],
  values: Record<string, string>,
): string | null {
  const nameField = fields.find((f) => f.type === "name");
  if (nameField && values[nameField.key]?.trim()) return values[nameField.key].trim();
  return values.name?.trim() || values.full_name?.trim() || null;
}

export function resolveLeadEmailFromValues(
  fields: CaptureFormField[],
  values: Record<string, string>,
): string | null {
  const emailField = fields.find((f) => f.type === "email");
  if (emailField && values[emailField.key]?.trim()) return values[emailField.key].trim();
  return values.email?.trim() || null;
}

export function resolveLeadPhoneFromValues(
  fields: CaptureFormField[],
  values: Record<string, string>,
): string | null {
  const phoneField = fields.find((f) => f.type === "phone");
  if (phoneField && values[phoneField.key]?.trim()) return values[phoneField.key].trim();
  return values.phone?.trim() || null;
}

/** Custom / extra fields → lead notes for CRM visibility. */
export function buildLeadNotesFromCaptureValues(
  fields: CaptureFormField[],
  values: Record<string, string>,
): string | null {
  const lines: string[] = [];
  for (const field of fields) {
    if (LEAD_COLUMN_KEYS.has(field.key)) continue;
    const val = values[field.key]?.trim();
    if (!val) continue;
    lines.push(`${field.label}: ${val}`);
  }
  return lines.length ? lines.join("\n") : null;
}
