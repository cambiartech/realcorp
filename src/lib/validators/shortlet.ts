import { z } from "zod";

export const createShortletUnitSchema = z.object({
  source: z.enum(["CUSTOM", "PROJECT_UNIT"]).default("CUSTOM"),
  projectUnitId: z.string().trim().optional().or(z.literal("")),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  nightlyRate: z.number().positive(),
  cleaningFee: z.number().min(0).optional(),
  currency: z.string().trim().min(3).max(8),
}).superRefine((data, ctx) => {
  if (data.source === "CUSTOM" && (!data.name || data.name.length < 2)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["name"],
      message: "Unit name must be at least 2 characters.",
    });
  }
  if (data.source === "PROJECT_UNIT" && !data.projectUnitId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["projectUnitId"],
      message: "Select a project unit to link.",
    });
  }
});

export const createShortletReservationSchema = z.object({
  unitId: z.string().trim().min(1, "Select a unit to reserve."),
  guestName: z.string().trim().min(2, "Guest name must be at least 2 characters.").max(120),
  guestEmail: z.string().trim().email().optional().or(z.literal("")),
  guestPhone: z.string().trim().max(40).optional().or(z.literal("")),
  checkIn: z.string().trim().min(1, "Select a check-in date."),
  checkInTime: z.string().trim().min(1, "Select a check-in time."),
  checkOut: z.string().trim().min(1, "Select a check-out date."),
  checkOutTime: z.string().trim().min(1, "Select a check-out time."),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  collectPaymentNow: z.boolean().optional().default(false),
  paymentAmount: z.number().nonnegative().optional(),
  paymentPaidAt: z.string().trim().optional().or(z.literal("")),
  paymentMethod: z.string().trim().max(60).optional().or(z.literal("")),
  paymentReference: z.string().trim().max(120).optional().or(z.literal("")),
  paymentNote: z.string().trim().max(300).optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  if (data.collectPaymentNow) {
    if (!data.paymentAmount || data.paymentAmount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentAmount"],
        message: "Enter the payment amount received now.",
      });
    }
    if (!data.paymentPaidAt || data.paymentPaidAt.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentPaidAt"],
        message: "Select when payment was made.",
      });
    }
  }
});

export const recordShortletPaymentSchema = z.object({
  amount: z.number().positive(),
  paidAt: z.string().trim().min(1),
  method: z.string().trim().max(60).optional().or(z.literal("")),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
