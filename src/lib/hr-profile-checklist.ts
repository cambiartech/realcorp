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
  | "healthInfo"
  | "additionalInfo"
  | "guarantorInfo"
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
  healthInfo: null,
  additionalInfo: null,
  guarantorInfo: null,
};

export function checklistProgress(items: ProfileChecklistItem[]) {
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function buildProfileChecklist(
  profile: ProfileChecklistProfile,
  documents: Array<{ category: HrDocumentCategory }>,
): ProfileChecklistItem[] {
  const docCats = new Set(documents.map((d) => d.category));
  return [
    {
      id: "biodata",
      label: "Biodata (personal & employment)",
      done: Boolean(profile.fullName && profile.phoneMobile && profile.position),
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
      hint: "Type TIN and RSA PIN in this wizard, on My HR, or Prefill with AI from an uploaded form",
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
      id: "health",
      label: "Health & certifications",
      done: hasJson(profile.healthInfo) || hasJson(profile.additionalInfo),
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
