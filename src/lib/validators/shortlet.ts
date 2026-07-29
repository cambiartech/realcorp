import { z } from "zod";

export const createShortletUnitSchema = z
  .object({
    source: z.enum(["CUSTOM", "PROJECT_UNIT"]).default("CUSTOM"),
    projectUnitId: z.string().trim().optional().or(z.literal("")),
    propertyId: z.string().trim().optional().or(z.literal("")),
    name: z.string().trim().max(120).optional().or(z.literal("")),
    location: z.string().trim().max(120).optional().or(z.literal("")),
    floor: z.string().trim().max(40).optional().or(z.literal("")),
    roomLayout: z.string().trim().max(80).optional().or(z.literal("")),
    sizeSqFt: z.number().int().positive().optional(),
    maxOccupancy: z.number().int().positive().optional(),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    amenities: z.array(z.string()).optional(),
    listingStatus: z.enum(["AVAILABLE", "UNAVAILABLE", "MAINTENANCE"]).default("AVAILABLE"),
    isActive: z.boolean().default(true),
    nightlyRate: z.number().positive(),
    cleaningFee: z.number().min(0).optional(),
    cautionFee: z.number().min(0).optional(),
    currency: z.string().trim().min(3).max(8),
  })
  .superRefine((data, ctx) => {
    if (data.source === "CUSTOM" && (!data.name || data.name.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "Apartment name must be at least 2 characters.",
      });
    }
    if (data.source === "PROJECT_UNIT" && !data.projectUnitId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["projectUnitId"],
        message: "Select a sales project unit to import.",
      });
    }
  });

export const saveShortletUnitSchema = z.object({
  id: z.string().trim().min(1),
  propertyId: z.string().trim().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(120),
  floor: z.string().trim().max(40).optional().or(z.literal("")),
  roomLayout: z.string().trim().max(80).optional().or(z.literal("")),
  sizeSqFt: z.number().int().positive().optional(),
  maxOccupancy: z.number().int().positive().optional(),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  amenities: z.array(z.string()).optional(),
  listingStatus: z.enum(["AVAILABLE", "UNAVAILABLE", "MAINTENANCE"]),
  isActive: z.boolean().default(true),
  nightlyRate: z.number().positive(),
  cleaningFee: z.number().min(0).optional(),
  cautionFee: z.number().min(0).optional(),
  currency: z.string().trim().min(3).max(8),
});

export const createShortletReservationSchema = z
  .object({
    guestId: z.string().trim().optional().or(z.literal("")),
    unitId: z.string().trim().optional().or(z.literal("")),
    propertyId: z.string().trim().optional().or(z.literal("")),
    guestName: z.string().trim().max(120).optional().or(z.literal("")),
    guestEmail: z.string().trim().email().optional().or(z.literal("")),
    guestPhone: z.string().trim().max(40).optional().or(z.literal("")),
    guestCount: z.number().int().positive().max(50).optional(),
    checkIn: z.string().trim().min(1, "Select a check-in date."),
    checkInTime: z.string().trim().min(1, "Select a check-in time."),
    checkOut: z.string().trim().min(1, "Select a check-out date."),
    checkOutTime: z.string().trim().min(1, "Select a check-out time."),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
    cautionFee: z.number().min(0).optional(),
    isWalkIn: z.boolean().optional().default(false),
    checkInImmediately: z.boolean().optional().default(false),
    collectPaymentNow: z.boolean().optional().default(false),
    paymentAmount: z.number().nonnegative().optional(),
    cautionFeePaid: z.number().nonnegative().optional(),
    paymentPaidAt: z.string().trim().optional().or(z.literal("")),
    paymentMethod: z.string().trim().max(60).optional().or(z.literal("")),
    paymentReference: z.string().trim().max(120).optional().or(z.literal("")),
    paymentNote: z.string().trim().max(300).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const hasGuestId = Boolean(data.guestId && data.guestId.trim());
    const hasGuestName = Boolean(data.guestName && data.guestName.trim().length >= 2);
    if (!hasGuestId && !hasGuestName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["guestId"],
        message: "Select an existing guest or enter a guest name.",
      });
    }
    const hasUnit = Boolean(data.unitId && data.unitId.trim());
    const hasProperty = Boolean(data.propertyId && data.propertyId.trim());
    if (!hasUnit && !hasProperty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["propertyId"],
        message:
          "Select a location, or assign an apartment now — you can also assign the apartment at check-in.",
      });
    }
    const isWalkIn = data.isWalkIn === true || data.checkInImmediately === true;
    if (isWalkIn && !hasUnit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unitId"],
        message: "Walk-in check-in requires an apartment.",
      });
    }
    if (data.collectPaymentNow) {
      if (data.paymentAmount == null || data.paymentAmount < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentAmount"],
          message: "Enter the booking amount received.",
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

export const createShortletBookingBatchSchema = z
  .object({
    guestId: z.string().trim().min(1, "Select a guest."),
    guestCount: z.number().int().positive().max(50).optional(),
    isWalkIn: z.boolean().optional().default(false),
    checkInImmediately: z.boolean().optional().default(false),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
    stays: z
      .array(
        z.object({
          unitId: z.string().trim().optional().or(z.literal("")),
          propertyId: z.string().trim().optional().or(z.literal("")),
          checkIn: z.string().trim().min(1),
          checkInTime: z.string().trim().min(1),
          checkOut: z.string().trim().min(1),
          checkOutTime: z.string().trim().min(1),
        }),
      )
      .min(1, "Add at least one apartment stay."),
    collectPaymentNow: z.boolean().optional().default(false),
    paymentAmount: z.number().nonnegative().optional(),
    cautionFeePaid: z.number().nonnegative().optional(),
    paymentPaidAt: z.string().trim().optional().or(z.literal("")),
    paymentMethod: z.string().trim().max(60).optional().or(z.literal("")),
    paymentReference: z.string().trim().max(120).optional().or(z.literal("")),
    paymentNote: z.string().trim().max(300).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const isWalkIn = data.isWalkIn === true || data.checkInImmediately === true;
    data.stays.forEach((stay, index) => {
      const hasUnit = Boolean(stay.unitId && stay.unitId.trim());
      const hasProperty = Boolean(stay.propertyId && stay.propertyId.trim());
      if (!hasUnit && !hasProperty) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stays", index, "propertyId"],
          message: "Select a location or apartment for each stay.",
        });
      }
      if (isWalkIn && !hasUnit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stays", index, "unitId"],
          message: "Walk-in requires an apartment for each stay.",
        });
      }
    });
    if (data.collectPaymentNow) {
      if (data.paymentAmount == null || data.paymentAmount < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["paymentAmount"],
          message: "Enter the booking amount received.",
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

export const saveShortletGuestSchema = z.object({
  id: z.string().trim().optional().or(z.literal("")),
  firstName: z.string().trim().min(2, "First name is required.").max(80),
  lastName: z.string().trim().max(80).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  guestType: z.enum(["INDIVIDUAL", "CORPORATE"]).default("INDIVIDUAL"),
  idType: z.string().trim().max(60).optional().or(z.literal("")),
  idNumber: z.string().trim().max(80).optional().or(z.literal("")),
  idDocumentUrl: z.string().trim().url().optional().or(z.literal("")),
  addressLine: z.string().trim().max(500).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const listAvailableShortletApartmentsSchema = z.object({
  checkIn: z.string().trim().min(1),
  checkInTime: z.string().trim().min(1),
  checkOut: z.string().trim().min(1),
  checkOutTime: z.string().trim().min(1),
  propertyId: z.string().trim().optional().or(z.literal("")),
  walkInOnly: z.boolean().optional().default(false),
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
  checkInTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/),
  checkOutTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/),
  eodTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/),
  checkoutAlertHours: z.number().int().min(1).max(24),
  financeSync: z.boolean().default(false),
});

export const saveShortletPropertySchema = z.object({
  id: z.string().trim().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(120),
  locationCode: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export const assignShortletUnitPropertySchema = z.object({
  unitId: z.string().trim().min(1),
  propertyId: z.string().trim().optional().or(z.literal("")),
});

export const importChannelLeadSchema = z
  .object({
    leadId: z.string().trim().min(1),
    unitId: z.string().trim().optional().or(z.literal("")),
    propertyId: z.string().trim().optional().or(z.literal("")),
    checkIn: z.string().trim().min(1),
    checkInTime: z.string().trim().min(1),
    checkOut: z.string().trim().min(1),
    checkOutTime: z.string().trim().min(1),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const hasUnit = Boolean(data.unitId && data.unitId.trim());
    const hasProperty = Boolean(data.propertyId && data.propertyId.trim());
    if (!hasUnit && !hasProperty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["propertyId"],
        message: "Select a location or apartment — apartment can be assigned later.",
      });
    }
  });

export const assignShortletReservationApartmentSchema = z.object({
  reservationId: z.string().trim().min(1),
  unitId: z.string().trim().min(1, "Select an apartment."),
});

export const updateHousekeepingStatusSchema = z.object({
  unitId: z.string().trim().min(1),
  status: z.enum(["VACANT_CLEAN", "VACANT_DIRTY", "OCCUPIED", "OUT_OF_ORDER"]),
});

export const completeShortletCheckoutInspectionSchema = z.object({
  inspectionId: z.string().trim().min(1),
  status: z.enum(["PASSED", "FAILED", "WAIVED"]),
  condition: z.enum(["GOOD", "DAMAGES_FOUND", "MAINTENANCE_REQUIRED"]).optional(),
  damageNotes: z.string().trim().max(2000).optional().or(z.literal("")),
  cautionDeduction: z.number().min(0).optional(),
  photoUrls: z.array(z.string().trim().url()).max(20).optional(),
});
