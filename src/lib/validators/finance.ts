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
  status: z.enum(["DRAFT", "SENT", "VOID"]).optional(),
});

export const recordPaymentInputSchema = z.object({
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
  note: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
});
