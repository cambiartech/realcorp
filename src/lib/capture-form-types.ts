export type CaptureFormFieldType =
  | "name"
  | "email"
  | "phone"
  | "text"
  | "textarea"
  | "select"
  | "number"
  | "project_interest"
  | "budget_range";

export type CaptureFormField = {
  key: string;
  type: CaptureFormFieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  halfWidth?: boolean;
};

export type CaptureFormAttribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingUrl?: string;
  sharerUserId?: string;
  realtorPartnerId?: string;
};

export type CaptureFormClientContext = {
  timezone?: string;
  localHour?: number;
  deviceType?: string;
  browser?: string;
  os?: string;
  userAgent?: string;
};

export const DEFAULT_LEAD_MAGNET_FIELDS: CaptureFormField[] = [
  { key: "name", type: "name", label: "Full name", required: true, placeholder: "Your name" },
  { key: "email", type: "email", label: "Email", required: true, placeholder: "you@example.com" },
  { key: "phone", type: "phone", label: "Phone / WhatsApp", placeholder: "+234…", halfWidth: true },
  { key: "project_interest", type: "project_interest", label: "Project interest", halfWidth: true },
  { key: "budget_range", type: "budget_range", label: "Budget range", placeholder: "e.g. ₦15M – ₦25M" },
];

export function slugifyCaptureFormName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function captureFormPublicPath(tenantSlug: string, formSlug: string): string {
  return `/f/${tenantSlug}/${formSlug}`;
}

export function buildCaptureFormShareUrl(
  baseUrl: string,
  tenantSlug: string,
  formSlug: string,
  params?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    ref?: string;
    partner?: string;
  },
): string {
  const url = new URL(captureFormPublicPath(tenantSlug, formSlug), baseUrl);
  if (params?.utmSource) url.searchParams.set("utm_source", params.utmSource);
  if (params?.utmMedium) url.searchParams.set("utm_medium", params.utmMedium);
  if (params?.utmCampaign) url.searchParams.set("utm_campaign", params.utmCampaign);
  if (params?.utmContent) url.searchParams.set("utm_content", params.utmContent);
  if (params?.utmTerm) url.searchParams.set("utm_term", params.utmTerm);
  if (params?.ref) url.searchParams.set("ref", params.ref);
  if (params?.partner) url.searchParams.set("partner", params.partner);
  return url.toString();
}

export function parseCaptureFormFields(raw: unknown): CaptureFormField[] {
  if (!Array.isArray(raw)) return DEFAULT_LEAD_MAGNET_FIELDS;
  return raw.filter(
    (f): f is CaptureFormField =>
      f &&
      typeof f === "object" &&
      typeof (f as CaptureFormField).key === "string" &&
      typeof (f as CaptureFormField).label === "string" &&
      typeof (f as CaptureFormField).type === "string",
  );
}

export function computeCompletionPct(fields: CaptureFormField[], values: Record<string, string>): number {
  const required = fields.filter((f) => f.required);
  const tracked = required.length ? required : fields;
  if (!tracked.length) return 0;
  const filled = tracked.filter((f) => (values[f.key] ?? "").trim().length > 0).length;
  return Math.round((filled / tracked.length) * 100);
}
