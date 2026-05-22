import type { z } from "zod";
import type { biodataFormSchema } from "@/lib/validators/hr-forms";

type Biodata = z.infer<typeof biodataFormSchema>;

/** Normalizes candidate biodata before validation — never accept self-entered employee IDs. */
export function normalizeBiodataSubmission(raw: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...raw };
  delete next.employeeNumber;

  if (next.nextOfKinSameAsEmergency === "yes") {
    next.nextOfKinName = next.emergencyName ?? "";
    next.nextOfKinRelationship = next.emergencyRelationship ?? "";
    next.nextOfKinPhone = next.emergencyPhone ?? "";
    next.nextOfKinEmail = next.emergencyEmail ?? "";
  }

  delete next.nextOfKinSameAsEmergency;
  return next;
}

export function biodataPayloadForMerge(payload: Biodata): Biodata {
  if (payload.nextOfKinSameAsEmergency === "yes") {
    return {
      ...payload,
      nextOfKinName: payload.emergencyName ?? "",
      nextOfKinRelationship: payload.emergencyRelationship ?? "",
      nextOfKinPhone: payload.emergencyPhone ?? "",
      nextOfKinEmail: payload.emergencyEmail ?? "",
    };
  }
  return payload;
}
