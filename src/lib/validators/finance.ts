import { z } from "zod";

export const createInvoiceInputSchema = z.object({
  dealId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  title: z
    .string()
    .trim()
    .min(2, "Invoice title must be at least 2 characters.")
    .max(120, "Invoice title is too long."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  currency: z
    .string()
    .trim()
    .min(3, "Currency must be 3 letters.")
    .max(3, "Currency must be 3 letters.")
    .transform((v) => v.toUpperCase()),
  dueDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  department: z
    .string()
    .trim()
    .max(80, "Department is too long.")
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
});

export const updateInvoiceInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Invoice title must be at least 2 characters.")
    .max(120, "Invoice title is too long."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  currency: z
    .string()
    .trim()
    .min(3, "Currency must be 3 letters.")
    .max(3, "Currency must be 3 letters.")
    .transform((v) => v.toUpperCase()),
  dueDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  department: z
    .string()
    .trim()
    .max(80, "Department is too long.")
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  status: z.enum(["DRAFT", "SENT", "VOID"]).optional(),
});

export const recordPaymentInputSchema = z.object({
  amount: z.coerce.number().positive("Payment amount must be greater than zero."),
  paidAt: z.string().trim().min(1, "Payment date is required."),
  department: z
    .string()
    .trim()
    .max(80, "Department is too long.")
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  method: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  reference: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  note: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  attachmentUrl: z
    .string()
    .trim()
    .url("Attachment URL must be a valid URL.")
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  attachmentName: z
    .string()
    .trim()
    .max(160, "Attachment name is too long.")
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  attachmentPublicId: z
    .string()
    .trim()
    .max(260, "Attachment public id is too long.")
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
});

export const recordStandalonePaymentInputSchema = recordPaymentInputSchema.extend({
  title: z.string().trim().min(2, "Payment title is required.").max(120, "Title is too long."),
  payerName: z
    .string()
    .trim()
    .max(120, "Payer name is too long.")
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  currency: z
    .string()
    .trim()
    .min(3, "Currency must be 3 letters.")
    .max(3, "Currency must be 3 letters.")
    .transform((v) => v.toUpperCase()),
});

export const createExpenseInputSchema = z.object({
  projectId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  unitId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  category: z.string().trim().min(2, "Expense category is required.").max(80, "Category is too long."),
  department: z
    .string()
    .trim()
    .max(80, "Department is too long.")
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  vendorName: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  amount: z.coerce.number().positive("Expense amount must be greater than zero."),
  vatTreatment: z.enum(["NONE", "EXCLUSIVE", "INCLUSIVE", "EXEMPT", "ZERO_RATED"]).default("NONE"),
  vatRate: z.coerce.number().min(0).max(100).default(0),
  vatRecoverable: z.coerce.boolean().optional(),
  currency: z
    .string()
    .trim()
    .min(3, "Currency must be 3 letters.")
    .max(3, "Currency must be 3 letters.")
    .transform((v) => v.toUpperCase()),
  expenseDate: z.string().trim().min(1, "Expense date is required."),
  paidThroughAccount: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  reference: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  note: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  attachmentUrl: z
    .string()
    .trim()
    .url("Attachment URL must be a valid URL.")
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  attachmentName: z
    .string()
    .trim()
    .max(160, "Attachment name is too long.")
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  attachmentPublicId: z
    .string()
    .trim()
    .max(260, "Attachment public id is too long.")
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
});

export const updateExpenseInputSchema = createExpenseInputSchema.extend({
  editReason: z.string().trim().min(3, "Give a reason for this correction.").max(500),
});

export const createSalesReceiptInputSchema = z.object({
  dealId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  title: z
    .string()
    .trim()
    .min(2, "Receipt title must be at least 2 characters.")
    .max(120, "Receipt title is too long."),
  customerName: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  amount: z.coerce.number().positive("Receipt amount must be greater than zero."),
  currency: z
    .string()
    .trim()
    .min(3, "Currency must be 3 letters.")
    .max(3, "Currency must be 3 letters.")
    .transform((v) => v.toUpperCase()),
  paymentMode: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  depositAccount: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  reference: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  note: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
});

const vendorBillRecurrenceFrequencySchema = z.enum(["DAILY", "WEEKLY", "MONTHLY"]);
const recurrenceRangeModeSchema = z.enum(["FISCAL_YEAR_END", "END_DATE", "PERIOD_COUNT"]);

export const createVendorBillInputSchema = z
  .object({
    vendorName: z.string().trim().min(2, "Vendor name is required.").max(120, "Vendor name is too long."),
    title: z
      .string()
      .trim()
      .max(120, "Bill title is too long.")
      .optional()
      .transform((v) => (v && v !== "" ? v : undefined)),
    amount: z.coerce.number().positive("Amount must be greater than zero."),
    currency: z
      .string()
      .trim()
      .min(3, "Currency must be 3 letters.")
      .max(3, "Currency must be 3 letters.")
      .transform((v) => v.toUpperCase()),
    dueDate: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v && v !== "" ? v : undefined)),
    department: z
      .string()
      .trim()
      .max(80, "Department is too long.")
      .optional()
      .transform((v) => (v && v !== "" ? v : undefined)),
    note: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v && v !== "" ? v : undefined)),
    isRecurring: z
      .union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("on"), z.literal("")])
      .optional()
      .transform((v) => v === true || v === "true" || v === "on"),
    recurrenceFrequency: vendorBillRecurrenceFrequencySchema.optional(),
    recurrenceRangeMode: recurrenceRangeModeSchema.optional(),
    recurrenceEndDate: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v && v !== "" ? v : undefined)),
    recurrencePeriodCount: z.coerce
      .number()
      .int("Use a whole number of periods.")
      .min(1, "Schedule at least one bill.")
      .max(366, "Cannot schedule more than 366 bills at once.")
      .optional(),
    useAutoTitle: z
      .union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("on"), z.literal("")])
      .optional()
      .transform((v) => v === true || v === "true" || v === "on"),
  })
  .superRefine((data, ctx) => {
    if (data.isRecurring && !data.recurrenceFrequency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose how often this bill repeats (daily, weekly, or monthly).",
        path: ["recurrenceFrequency"],
      });
    }
    if (data.isRecurring && !data.dueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Due date is required for recurring bills so we can schedule periods.",
        path: ["dueDate"],
      });
    }
    if (data.isRecurring && !data.recurrenceRangeMode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose how long this schedule should run.",
        path: ["recurrenceRangeMode"],
      });
    }
    if (data.isRecurring && data.recurrenceRangeMode === "END_DATE" && !data.recurrenceEndDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pick an end date for the schedule.",
        path: ["recurrenceEndDate"],
      });
    }
    if (data.isRecurring && data.recurrenceRangeMode === "PERIOD_COUNT" && !data.recurrencePeriodCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter how many bills to create in this schedule.",
        path: ["recurrencePeriodCount"],
      });
    }
    if (
      data.isRecurring &&
      data.recurrenceRangeMode === "END_DATE" &&
      data.recurrenceEndDate &&
      data.dueDate
    ) {
      const start = new Date(`${data.dueDate}T12:00:00`).getTime();
      const end = new Date(`${data.recurrenceEndDate}T12:00:00`).getTime();
      if (!Number.isNaN(start) && !Number.isNaN(end) && end < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End date must be on or after the first due date.",
          path: ["recurrenceEndDate"],
        });
      }
    }
    if (!data.isRecurring && !data.useAutoTitle && (!data.title || data.title.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bill title must be at least 2 characters.",
        path: ["title"],
      });
    }
  });

export const recordVendorBillPaymentInputSchema = z.object({
  amount: z.coerce.number().positive("Payment amount must be greater than zero."),
  paidAt: z.string().trim().min(1, "Payment date is required."),
  method: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  reference: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  paidThroughAccount: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
});

export const financeControlsInputSchema = z.object({
  expenseApprovalThreshold: z.coerce
    .number()
    .nonnegative("Threshold cannot be negative.")
    .optional()
    .transform((v) => (v === undefined || Number.isNaN(v) ? undefined : v)),
  firstReminderAfterDays: z.coerce
    .number()
    .int()
    .min(1, "First reminder must be at least 1 day.")
    .max(90, "First reminder cannot exceed 90 days.")
    .optional(),
  secondReminderAfterDays: z.coerce
    .number()
    .int()
    .min(1, "Second reminder must be at least 1 day.")
    .max(180, "Second reminder cannot exceed 180 days.")
    .optional(),
});
