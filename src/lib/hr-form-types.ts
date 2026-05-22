import type { HrFormDeliveryMode, HrFormType } from "@/generated/prisma";

export const HR_FORM_TYPE_LABELS: Record<HrFormType, string> = {
  BIODATA: "Employee biodata",
  BANK_FORM: "Bank account information",
  GUARANTOR: "Guarantor form",
  HEALTH: "Health & additional information",
};

export const HR_FORM_OPTIONS: { value: HrFormType; label: string }[] = [
  { value: "BIODATA", label: "Biodata" },
  { value: "BANK_FORM", label: "Bank account" },
  { value: "GUARANTOR", label: "Guarantor" },
  { value: "HEALTH", label: "Health & additional" },
];

export const HR_FORM_DELIVERY_LABELS: Record<HrFormDeliveryMode, string> = {
  ONLINE_FILL: "Fill online (link)",
  PRINT_UPLOAD: "Print, sign, and upload",
  BOTH: "Online fill or print & upload",
};

export function hrFormPrintPath(token: string) {
  return `/hr-form/${token}/print`;
}

export function hrFormFillPath(token: string) {
  return `/hr-form/${token}`;
}

export function hrOnboardingBundlePath(
  bundleToken: string,
  query?: { form?: string; tenant?: string },
) {
  const params = new URLSearchParams();
  if (query?.tenant) params.set("tenant", query.tenant);
  if (query?.form) params.set("form", query.form);
  const qs = params.toString();
  return `/hr-onboarding/${bundleToken}${qs ? `?${qs}` : ""}`;
}

/** Stable order for multi-form onboarding wizard. */
export const HR_FORM_TYPE_ORDER: HrFormType[] = ["BIODATA", "BANK_FORM", "GUARANTOR", "HEALTH"];

export function sortFormTypes(types: HrFormType[]): HrFormType[] {
  const set = new Set(types);
  return HR_FORM_TYPE_ORDER.filter((t) => set.has(t));
}
