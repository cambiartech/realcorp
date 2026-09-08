export type PendingProfileUpdate = {
  submittedAt: string;
  submittedByLabel: string;
  phoneMobile?: string;
  dateOfJoining?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressCountry?: string;
  emergencyName?: string;
  emergencyRelationship?: string;
  emergencyPhone?: string;
  emergencyEmail?: string;
  nextOfKinName?: string;
  nextOfKinRelationship?: string;
  nextOfKinPhone?: string;
  nextOfKinEmail?: string;
  nextOfKinOccupation?: string;
  nextOfKinStreet?: string;
  nextOfKinCity?: string;
  nextOfKinState?: string;
  nextOfKinCountry?: string;
};

const FIELD_LABELS: Array<[keyof Omit<PendingProfileUpdate, "submittedAt" | "submittedByLabel">, string]> = [
  ["phoneMobile", "Mobile phone"],
  ["dateOfJoining", "Date of joining"],
  ["addressStreet", "Street address"],
  ["addressCity", "City"],
  ["addressState", "State"],
  ["addressCountry", "Country"],
  ["emergencyName", "Emergency contact"],
  ["emergencyRelationship", "Emergency relationship"],
  ["emergencyPhone", "Emergency phone"],
  ["emergencyEmail", "Emergency email"],
  ["nextOfKinName", "Next of kin"],
  ["nextOfKinRelationship", "Next of kin relationship"],
  ["nextOfKinPhone", "Next of kin phone"],
  ["nextOfKinEmail", "Next of kin email"],
  ["nextOfKinOccupation", "Next of kin occupation"],
  ["nextOfKinStreet", "Next of kin street"],
  ["nextOfKinCity", "Next of kin city"],
  ["nextOfKinState", "Next of kin state"],
  ["nextOfKinCountry", "Next of kin country"],
];

export function parsePendingProfileUpdate(value: unknown): PendingProfileUpdate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.submittedAt !== "string") return null;
  return row as PendingProfileUpdate;
}

export function pendingProfileChangeLines(pending: PendingProfileUpdate): string[] {
  return FIELD_LABELS.flatMap(([key, label]) => {
    const value = pending[key];
    return typeof value === "string" && value.trim() ? [`${label}: ${value.trim()}`] : [];
  });
}
