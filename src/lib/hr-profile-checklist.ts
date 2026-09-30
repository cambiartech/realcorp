import type { EmployeeProfile, HrDocumentCategory } from "@/generated/prisma";
import { statutoryIdsSettled } from "@/lib/hr-statutory";

function hasJson(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  return Object.values(obj as Record<string, unknown>).some((v) => v !== "" && v != null);
}

export type ProfileChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
  /** Soft items (e.g. TIN / RSA) — shown but excluded from % complete / payroll gate. */
  optional?: boolean;
};

export type ProfileChecklistProfile = Pick<
  EmployeeProfile,
  | "fullName"
  | "phoneMobile"
  | "position"
  | "bankAccount"
  | "taxId"
  | "rsaPin"
  | "pensionAdministrator"
  | "pensionEnabled"
  | "emergencyContact"
  | "nextOfKin"
  | "guarantorInfo"
  | "employmentType"
  | "photoUrl"
  | "grossMonthly"
>;

export const EMPTY_PROFILE_CHECKLIST_PROFILE: ProfileChecklistProfile = {
  fullName: null,
  phoneMobile: null,
  position: null,
  bankAccount: null,
  taxId: null,
  rsaPin: null,
  pensionAdministrator: null,
  pensionEnabled: true,
  emergencyContact: null,
  nextOfKin: null,
  guarantorInfo: null,
  employmentType: null,
  photoUrl: null,
  grossMonthly: null,
};

/** Contract / adhoc / service-provider staff — SLA and bank are required; the employee pack is optional. */
export function isContingentEmployment(employmentType?: string | null): boolean {
  const value = (employmentType || "").trim().toLowerCase();
  if (!value) return false;
  return (
    value.includes("contract") ||
    value.includes("adhoc") ||
    value.includes("ad-hoc") ||
    value.includes("temporary") ||
    value.includes("casual") ||
    value.includes("consultant") ||
    value.includes("service") ||
    value.includes("vendor") ||
    value.includes("outsource")
  );
}

export function checklistProgress(items: ProfileChecklistItem[]) {
  const required = items.filter((i) => !i.optional);
  const done = required.filter((i) => i.done).length;
  const total = required.length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function buildProfileChecklist(
  profile: ProfileChecklistProfile,
  documents: Array<{ category: HrDocumentCategory }>,
): ProfileChecklistItem[] {
  const contingent = isContingentEmployment(profile.employmentType);
  if (contingent) {
    const gross = profile.grossMonthly != null && Number(profile.grossMonthly) > 0;
    const docCats = new Set(documents.map((d) => d.category));
    const suggested = "Useful if you have it. Not required for contract staff, and no onboarding link is needed.";
    return [
      {
        id: "basics",
        label: "Name & role on file",
        done: Boolean(profile.fullName),
      },
      {
        id: "pay",
        label: "Pay amount set",
        done: gross,
        hint: "Set monthly gross so they appear on Payslips",
      },
      {
        id: "bank",
        label: "Bank account",
        done: hasJson(profile.bankAccount),
        hint: "The account we pay",
      },
      {
        id: "sla",
        label: "SLA on file",
        done: docCats.has("CONTRACT"),
        hint: "Upload the service agreement under Documents → SLA / contract",
      },
      {
        id: "biodata",
        label: "Biodata",
        done: Boolean(profile.fullName && profile.phoneMobile && profile.position),
        optional: true,
        hint: suggested,
      },
      {
        id: "photo",
        label: "Passport photo",
        done: Boolean(profile.photoUrl),
        optional: true,
        hint: suggested,
      },
      {
        id: "statutory",
        label: "Statutory IDs (TIN / pension)",
        done: statutoryIdsSettled({
          taxId: profile.taxId,
          rsaPin: profile.rsaPin,
          pensionAdministrator: profile.pensionAdministrator,
          pensionEnabled: profile.pensionEnabled,
        }),
        optional: true,
        hint: suggested,
      },
      {
        id: "emergency",
        label: "Emergency contact",
        done: hasJson(profile.emergencyContact),
        optional: true,
        hint: suggested,
      },
      {
        id: "nextOfKin",
        label: "Next of kin",
        done: hasJson(profile.nextOfKin),
        optional: true,
        hint: suggested,
      },
      {
        id: "guarantor",
        label: "Guarantor details",
        done: hasJson(profile.guarantorInfo) || docCats.has("GUARANTOR"),
        optional: true,
        hint: suggested,
      },
      {
        id: "nda",
        label: "NDA on file",
        done: docCats.has("NDA"),
        optional: true,
        hint: suggested,
      },
      {
        id: "offer",
        label: "Offer letter on file",
        done: docCats.has("OFFER_LETTER"),
        optional: true,
        hint: "Contract staff usually use an SLA instead. Add an offer letter only if you want one.",
      },
    ];
  }

  const docCats = new Set(documents.map((d) => d.category));
  return [
    {
      id: "biodata",
      label: "Biodata (personal & employment)",
      done: Boolean(profile.fullName && profile.phoneMobile && profile.position),
    },
    {
      id: "photo",
      label: "Passport photo",
      done: Boolean(profile.photoUrl),
      hint: "Upload on the employee record or from My HR",
    },
    {
      id: "bank",
      label: "Bank account",
      done: hasJson(profile.bankAccount),
    },
    {
      id: "statutory",
      label: "Statutory IDs (TIN / pension)",
      done: statutoryIdsSettled({
        taxId: profile.taxId,
        rsaPin: profile.rsaPin,
        pensionAdministrator: profile.pensionAdministrator,
        pensionEnabled: profile.pensionEnabled,
      }),
      optional: true,
      hint: "Does not affect onboarding %. Leave blank, set NIL, or mark pension Not applicable if they are not interested.",
    },
    {
      id: "emergency",
      label: "Emergency contact",
      done: hasJson(profile.emergencyContact),
    },
    {
      id: "nextOfKin",
      label: "Next of kin",
      done: hasJson(profile.nextOfKin),
    },
    {
      id: "guarantor",
      label: "Guarantor details",
      done: hasJson(profile.guarantorInfo) || docCats.has("GUARANTOR"),
    },
    {
      id: "nda",
      label: "NDA on file",
      done: docCats.has("NDA"),
      hint: "Upload signed NDA or send for signature",
    },
    {
      id: "offer",
      label: "Offer letter on file",
      done: docCats.has("OFFER_LETTER"),
    },
  ];
}
