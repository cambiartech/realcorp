import type { ProfileDetailRow } from "@/lib/hr-profile-form";

function field(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

/** Merge submitted form values into the in-memory draft (keeps fields not in the form). */
export function mergeProfileDraftFromForm(draft: ProfileDetailRow, form: HTMLFormElement): ProfileDetailRow {
  const fd = new FormData(form);
  const gross = field(fd, "grossMonthly");
  const payee = field(fd, "payeeTaxMonthly");

  return {
    ...draft,
    fullName: field(fd, "fullName") || draft.fullName,
    employeeNumber: field(fd, "employeeNumber") || draft.employeeNumber,
    gender: field(fd, "gender") || draft.gender,
    dateOfBirth: field(fd, "dateOfBirth") || draft.dateOfBirth,
    maritalStatus: field(fd, "maritalStatus") || draft.maritalStatus,
    nationality: field(fd, "nationality") || draft.nationality,
    phoneMobile: field(fd, "phoneMobile") || draft.phoneMobile,
    workEmail: field(fd, "workEmail") || draft.workEmail,
    addressStreet: field(fd, "addressStreet") || draft.addressStreet,
    addressCity: field(fd, "addressCity") || draft.addressCity,
    addressState: field(fd, "addressState") || draft.addressState,
    position: field(fd, "position") || draft.position,
    department: field(fd, "department") || draft.department,
    dateOfJoining: field(fd, "dateOfJoining") || draft.dateOfJoining,
    reportsToUserId: field(fd, "reportsToUserId") || draft.reportsToUserId,
    reportingToLabel: field(fd, "reportingToLabel") || draft.reportingToLabel,
    employmentType: field(fd, "employmentType") || draft.employmentType,
    workSchedule: field(fd, "workSchedule") || draft.workSchedule,
    paygroupName: field(fd, "paygroupName") || draft.paygroupName,
    payTemplateId: field(fd, "payTemplateId") || draft.payTemplateId,
    grossMonthly: gross || draft.grossMonthly,
    payeeTaxMonthly: payee || draft.payeeTaxMonthly,
    taxId: field(fd, "taxId") || draft.taxId,
    rsaPin: field(fd, "rsaPin") || draft.rsaPin,
    pensionAdministrator: field(fd, "pensionAdministrator") || draft.pensionAdministrator,
    nhfMembershipNumber: field(fd, "nhfMembershipNumber") || draft.nhfMembershipNumber,
    bankAccountHolderName: field(fd, "bankAccountHolderName") || draft.bankAccountHolderName,
    bankName: field(fd, "bankName") || draft.bankName,
    bankAccountNumber: field(fd, "bankAccountNumber") || draft.bankAccountNumber,
    bankCode: field(fd, "bankCode") || draft.bankCode,
    bankAccountType: field(fd, "bankAccountType") || draft.bankAccountType,
    bankReceivePayments: field(fd, "bankReceivePayments") || draft.bankReceivePayments,
    emergencyName: field(fd, "emergencyName") || draft.emergencyName,
    emergencyRelationship: field(fd, "emergencyRelationship") || draft.emergencyRelationship,
    emergencyPhone: field(fd, "emergencyPhone") || draft.emergencyPhone,
    emergencyEmail: field(fd, "emergencyEmail") || draft.emergencyEmail,
    status: field(fd, "status") || draft.status,
  };
}

const DRAFT_KEYS = [
  "fullName",
  "employeeNumber",
  "gender",
  "dateOfBirth",
  "maritalStatus",
  "nationality",
  "phoneMobile",
  "workEmail",
  "addressStreet",
  "addressCity",
  "addressState",
  "addressCountry",
  "position",
  "department",
  "dateOfJoining",
  "employmentType",
  "workSchedule",
  "paygroupName",
  "payTemplateId",
  "grossMonthly",
  "payeeTaxMonthly",
  "taxId",
  "rsaPin",
  "pensionAdministrator",
  "nhfMembershipNumber",
  "bankAccountHolderName",
  "bankName",
  "bankAccountNumber",
  "bankCode",
  "bankAccountType",
  "emergencyName",
  "emergencyRelationship",
  "emergencyPhone",
  "emergencyEmail",
] as const satisfies readonly (keyof ProfileDetailRow)[];

export type OnboardingDraftPatch = Partial<Pick<ProfileDetailRow, (typeof DRAFT_KEYS)[number]>>;

function draftStorageKey(tenantSlug: string, userId: string) {
  return `boerp-hr-onboard-draft:${tenantSlug}:${userId}`;
}

export function readStoredOnboardingDraft(tenantSlug: string, userId: string): OnboardingDraftPatch | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(draftStorageKey(tenantSlug, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as OnboardingDraftPatch;
  } catch {
    return null;
  }
}

export function writeStoredOnboardingDraft(tenantSlug: string, userId: string, draft: ProfileDetailRow) {
  if (typeof window === "undefined" || !userId) return;
  const patch: OnboardingDraftPatch = {};
  for (const key of DRAFT_KEYS) {
    const value = draft[key];
    if (typeof value === "string" && value.trim()) patch[key] = value;
  }
  try {
    localStorage.setItem(draftStorageKey(tenantSlug, userId), JSON.stringify(patch));
  } catch {
    /* ignore */
  }
}

export function clearStoredOnboardingDraft(tenantSlug: string, userId: string) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.removeItem(draftStorageKey(tenantSlug, userId));
  } catch {
    /* ignore */
  }
}

/** Typed draft fields win. Blank draft fields leave the saved record as it is. */
export function applyStoredOnboardingDraft(
  record: ProfileDetailRow,
  stored: OnboardingDraftPatch | null,
): ProfileDetailRow {
  if (!stored) return record;
  const next = { ...record };
  for (const key of DRAFT_KEYS) {
    const value = stored[key];
    if (typeof value === "string" && value.trim()) next[key] = value;
  }
  return next;
}

export function profileDraftFingerprint(draft: ProfileDetailRow): string {
  return [
    draft.id,
    draft.position,
    draft.department,
    draft.grossMonthly,
    draft.phoneMobile,
    draft.bankName,
  ].join("|");
}
