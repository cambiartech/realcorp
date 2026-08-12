import { z } from "zod";

const jsonOptional = z
  .union([z.string(), z.record(z.string(), z.unknown())])
  .optional()
  .transform((v) => {
    if (!v) return undefined;
    if (typeof v === "object") return v;
    if (!v.trim()) return undefined;
    try {
      return JSON.parse(v) as unknown;
    } catch {
      return undefined;
    }
  });

const moneyOptional = z
  .union([z.number(), z.string()])
  .optional()
  .superRefine((val, ctx) => {
    if (val === undefined || val === "") return;
    const s = String(val).trim().replace(/,/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(s)) {
      ctx.addIssue({ code: "custom", message: "Monthly gross pay must be a valid number (digits only)." });
    }
  })
  .transform((val) => {
    if (val === undefined || val === "") return undefined;
    const s = String(val).trim().replace(/,/g, "");
    return Number(s);
  });

const percentOptional = z.coerce.number().min(0).max(100).optional();

export const upsertEmployeeProfileSchema = z.object({
  userId: z.string().min(1, "Select a team member."),
  employeeNumber: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  fullName: z.string().trim().min(2).max(120),
  gender: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  dateOfBirth: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  maritalStatus: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  nationality: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  phoneMobile: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  workEmail: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v !== "" ? v : undefined)),
  addressStreet: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  addressCity: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  addressState: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  addressCountry: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  position: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  department: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  dateOfJoining: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  reportingToLabel: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  employmentType: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  workSchedule: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  paygroupName: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  payTemplateId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  grossMonthly: moneyOptional,
  payeeTaxMonthly: moneyOptional,
  payrollCountryCode: z.string().trim().toUpperCase().length(2).optional(),
  payrollRegionCode: z.string().trim().max(20).optional(),
  taxId: z.string().trim().max(80).optional(),
  taxOverrideReason: z.string().trim().max(240).optional(),
  pensionEnabled: z.coerce.boolean().optional(),
  employeePensionRate: percentOptional,
  employerPensionRate: percentOptional,
  nhfMonthly: moneyOptional,
  nhiaMonthly: moneyOptional,
  annualRent: moneyOptional,
  annualLifeInsurance: moneyOptional,
  annualMortgageInterest: moneyOptional,
  otherPreTaxMonthly: moneyOptional,
  otherPostTaxMonthly: moneyOptional,
  basicPercent: z.coerce.number().min(0).max(100).optional(),
  housingPercent: z.coerce.number().min(0).max(100).optional(),
  transportPercent: z.coerce.number().min(0).max(100).optional(),
  otherPercent: z.coerce.number().min(0).max(100).optional(),
  emergencyContactJson: jsonOptional,
  educationJson: jsonOptional,
  nextOfKinJson: jsonOptional,
  healthInfoJson: jsonOptional,
  additionalInfoJson: jsonOptional,
  bankAccountJson: jsonOptional,
  guarantorInfoJson: jsonOptional,
  hrNotes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  status: z.enum(["DRAFT", "ACTIVE", "EXITED"]).optional(),
});

export const createAppraisalActionSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  cycleType: z.enum(["MONTHLY", "YEARLY"]),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});

export const createAppraisalCycleSchema = z.object({
  cycleType: z.enum(["MONTHLY", "YEARLY"]),
  periodLabel: z.string().trim().min(2).max(40),
  dueDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
});

export const createPayslipRunSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  paygroupName: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" && v !== "ALL" ? v : undefined)),
});

export const createPayTemplateSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    countryCode: z.string().trim().toUpperCase().length(2),
    basicPercent: z.coerce.number().min(0).max(100),
    housingPercent: z.coerce.number().min(0).max(100),
    transportPercent: z.coerce.number().min(0).max(100),
    otherPercent: z.coerce.number().min(0).max(100),
    pensionEnabled: z.coerce.boolean().default(true),
    employeePensionRate: z.coerce.number().min(0).max(100),
    employerPensionRate: z.coerce.number().min(0).max(100),
    isDefault: z.coerce.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const total =
      value.basicPercent + value.housingPercent + value.transportPercent + value.otherPercent;
    if (Math.abs(total - 100) > 0.01) {
      ctx.addIssue({ code: "custom", message: "Salary allocation percentages must total 100%." });
    }
  });

export const applyPayTemplateSchema = z.object({
  employeeProfileId: z.string().min(1),
  templateId: z.string().min(1),
});

export const savePayrollAdjustmentSchema = z.object({
  runId: z.string().min(1),
  employeeProfileId: z.string().min(1),
  type: z.enum(["EARNING", "DEDUCTION"]),
  label: z.string().trim().min(2).max(100),
  amount: z.coerce.number().positive().max(1_000_000_000_000),
  taxable: z.coerce.boolean().optional(),
  pensionable: z.coerce.boolean().optional(),
  preTax: z.coerce.boolean().optional(),
});

export const markPayslipPaymentsSchema = z.object({
  payslipIds: z.array(z.string().min(1)).min(1),
  paymentStatus: z.enum(["PENDING", "PAID"]),
  paymentReference: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
});

export const addHrDocumentSchema = z
  .object({
    employeeProfileId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    category: z.enum([
      "BIODATA",
      "BANK_FORM",
      "EMERGENCY_CONTACT",
      "NEXT_OF_KIN",
      "HEALTH_RECORD",
      "EDUCATION",
      "OFFER_LETTER",
      "NDA",
      "GUARANTOR",
      "JOB_DESCRIPTION",
      "CONTRACT",
      "PAYSLIP",
      "APPRAISAL",
      "OTHER",
    ]),
    title: z.string().trim().min(2).max(160),
    fileUrl: z.string().url(),
    fileName: z.string().trim().max(200).optional(),
  })
  .refine((d) => Boolean(d.employeeProfileId || d.userId), {
    message: "Select an employee for this document.",
    path: ["employeeProfileId"],
  });

export const upsertPerformanceGoalSchema = z.object({
  employeeProfileId: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  targetValue: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  progressPercent: z.coerce.number().int().min(0).max(100).optional(),
  dueDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
});

export const updatePerformanceGoalSchema = z.object({
  id: z.string().min(1),
  progressPercent: z.coerce.number().int().min(0).max(100).optional(),
  status: z.enum(["IN_PROGRESS", "COMPLETED", "ON_HOLD"]).optional(),
});
