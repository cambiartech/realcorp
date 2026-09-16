import type { EmployeeProfile, HrDocumentCategory } from "@/generated/prisma";

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
  emergencyContact: null,
  nextOfKin: null,
  guarantorInfo: null,
  employmentType: null,
  photoUrl: null,
  grossMonthly: null,
};

/** Contract / adhoc / service-provider staff — paid via HR, no employee form pack. */
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
    return [
      {
        id: "basics",
        label: "Name & role on file",
        done: Boolean(profile.fullName),
        hint: "No biodata / guarantor forms needed for service providers",
      },
      {
        id: "pay",
        label: "Pay amount set",
        done: gross,
        hint: "Set monthly gross so they appear on Payslips",
      },
      {
        id: "payout",
        label: "Where to pay (bank or company)",
        done: hasJson(profile.bankAccount),
        hint: "Optional — bank details, or note the vendor company on the record",
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
      label: "Statutory IDs (TIN / RSA PIN)",
      done: Boolean(profile.taxId && profile.rsaPin),
      optional: true,
      hint: "Optional for payroll — skip if the employee opts out of pension or TIN is not on file yet",
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
