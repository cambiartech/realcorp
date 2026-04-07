import { DealStage } from "@/generated/prisma";
import { z } from "zod";

export const createDealSchema = z.object({
  leadId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  unitId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  assignedUserId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  value: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined))
    .refine((v) => !v || !Number.isNaN(Number(v)), "Value must be a valid number."),
  stage: z.nativeEnum(DealStage).default(DealStage.NEW_LEAD),
  pendingFinance: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export const moveDealStageSchema = z.object({
  stage: z.nativeEnum(DealStage),
});

export function parseCreateDealForm(formData: FormData) {
  const getString = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
  };
  return createDealSchema.safeParse({
    leadId: getString("leadId"),
    unitId: getString("unitId"),
    assignedUserId: getString("assignedUserId"),
    value: getString("value"),
    stage: getString("stage") || DealStage.NEW_LEAD,
    pendingFinance: getString("pendingFinance"),
  });
}

export function parseMoveDealStageForm(formData: FormData) {
  const stage = formData.get("stage");
  return moveDealStageSchema.safeParse({
    stage: typeof stage === "string" ? stage : undefined,
  });
}
