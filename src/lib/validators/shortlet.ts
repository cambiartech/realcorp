import { z } from "zod";

export const createShortletUnitSchema = z.object({
  source: z.enum(["CUSTOM", "PROJECT_UNIT"]).default("CUSTOM"),
  projectUnitId: z.string().trim().optional().or(z.literal("")),
  propertyId: z.string().trim().optional().or(z.literal("")),
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
  isWalkIn: z.boolean().optional().default(false),
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

export const postShortletFolioSchema = z.object({
  reservationId: z.string().trim().min(1),
  department: z.enum(["ROOM", "FNB", "LAUNDRY", "LOUNGE", "GYM", "OTHER"]),
  serviceItemId: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().min(2).max(200),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().positive(),
});

export const saveShortletServiceItemSchema = z.object({
  id: z.string().trim().optional().or(z.literal("")),
  department: z.enum(["ROOM", "FNB", "LAUNDRY", "LOUNGE", "GYM", "OTHER"]),
  name: z.string().trim().min(2).max(120),
  price: z.number().positive(),
  currency: z.string().trim().min(3).max(8),
  active: z.boolean().default(true),
});

export const saveShortletPmsSettingsSchema = z.object({
  checkInTime: z.string().trim().regex(/^\d{2}:\d{2}$/),
  checkOutTime: z.string().trim().regex(/^\d{2}:\d{2}$/),
  eodTime: z.string().trim().regex(/^\d{2}:\d{2}$/),
  checkoutAlertHours: z.number().int().min(1).max(24),
  financeSync: z.boolean().default(false),
});

export const saveShortletPropertySchema = z.object({
  id: z.string().trim().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export const assignShortletUnitPropertySchema = z.object({
  unitId: z.string().trim().min(1),
  propertyId: z.string().trim().optional().or(z.literal("")),
});

export const importChannelLeadSchema = z.object({
  leadId: z.string().trim().min(1),
  unitId: z.string().trim().min(1),
  checkIn: z.string().trim().min(1),
  checkInTime: z.string().trim().min(1),
  checkOut: z.string().trim().min(1),
  checkOutTime: z.string().trim().min(1),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const updateHousekeepingStatusSchema = z.object({
  unitId: z.string().trim().min(1),
  status: z.enum(["VACANT_CLEAN", "VACANT_DIRTY", "OCCUPIED", "OUT_OF_ORDER"]),
});
