import { z } from "zod";

export const createInvoiceInputSchema = z.object({
  dealId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  title: z.string().trim().min(2, "Invoice title must be at least 2 characters.").max(120, "Invoice title is too long."),
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
  title: z.string().trim().min(2, "Invoice title must be at least 2 characters.").max(120, "Invoice title is too long."),
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

export const createExpenseInputSchema = z.object({
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

export const createSalesReceiptInputSchema = z.object({
  dealId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  title: z.string().trim().min(2, "Receipt title must be at least 2 characters.").max(120, "Receipt title is too long."),
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

export const createVendorBillInputSchema = z.object({
  vendorName: z.string().trim().min(2, "Vendor name is required.").max(120, "Vendor name is too long."),
  title: z.string().trim().min(2, "Bill title must be at least 2 characters.").max(120, "Bill title is too long."),
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
