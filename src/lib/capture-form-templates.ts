import type { CaptureFormField } from "@/lib/capture-form-types";
import { DEFAULT_LEAD_MAGNET_FIELDS } from "@/lib/capture-form-types";

export type CaptureFormTemplateId = "lead_magnet" | "contact" | "event" | "blank";

export const CAPTURE_FORM_TEMPLATES: Array<{
  id: CaptureFormTemplateId;
  name: string;
  description: string;
  fields: CaptureFormField[];
}> = [
  {
    id: "lead_magnet",
    name: "Lead magnet (recommended)",
    description: "Name, email, phone, project interest, budget — ideal for property bio links.",
    fields: DEFAULT_LEAD_MAGNET_FIELDS,
  },
  {
    id: "contact",
    name: "Simple contact",
    description: "Name, email, phone, and a message field.",
    fields: [
      { key: "name", type: "name", label: "Full name", required: true },
      { key: "email", type: "email", label: "Email", required: true, halfWidth: true },
      { key: "phone", type: "phone", label: "Phone / WhatsApp", halfWidth: true },
      { key: "message", type: "textarea", label: "How can we help?", required: true, placeholder: "Tell us what you're looking for…" },
    ],
  },
  {
    id: "event",
    name: "Event / webinar signup",
    description: "Capture RSVPs with role and company.",
    fields: [
      { key: "name", type: "name", label: "Full name", required: true },
      { key: "email", type: "email", label: "Email", required: true },
      { key: "phone", type: "phone", label: "Phone", halfWidth: true },
      {
        key: "role",
        type: "select",
        label: "I am a",
        required: true,
        halfWidth: true,
        options: ["Investor", "Home buyer", "Realtor", "Other"],
      },
      { key: "company", type: "text", label: "Company (optional)", placeholder: "Your company" },
    ],
  },
  {
    id: "blank",
    name: "Blank — build from scratch",
    description: "Start empty and add your own fields.",
    fields: [],
  },
];

export function resolveCaptureFormTemplate(id: string | null | undefined): CaptureFormField[] {
  const template = CAPTURE_FORM_TEMPLATES.find((t) => t.id === id);
  if (!template) return DEFAULT_LEAD_MAGNET_FIELDS;
  return template.fields.map((f) => ({ ...f }));
}

export const CAPTURE_FIELD_TYPE_LABELS: Record<CaptureFormField["type"], string> = {
  name: "Full name",
  email: "Email",
  phone: "Phone",
  text: "Short text",
  textarea: "Long text",
  select: "Dropdown",
  number: "Number",
  project_interest: "Project picker",
  budget_range: "Budget range",
};

export function slugifyFieldKey(label: string, index: number): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
  return base || `field_${index + 1}`;
}
