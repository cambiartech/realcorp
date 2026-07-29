"use server";

import { auth } from "@/auth";
import {
  MembershipRole,
  MembershipStatus,
  ShortletFolioDepartment,
  ShortletHousekeepingStatus,
  ShortletInspectionStatus,
  ShortletGuestType,
  ShortletListingStatus,
  ShortletReservationSource,
  ShortletReservationStatus,
} from "@/generated/prisma";
import prisma from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import {
  canManageHousekeeping,
  canManageShortLets,
  canManageShortletSettings,
  canPostFolio,
  type ShortletsAccessContext,
} from "@/lib/shortlets-access";
import { syncDayPaymentsToFinance, syncShortletPaymentToFinance } from "@/lib/shortlets-finance-bridge";
import { nextShortletBookingNumber } from "@/lib/shortlets-booking-number";
import { findOrCreateShortletGuest } from "@/lib/shortlets-guests";
import {
  ACTIVE_FOLIO_STATUSES,
  BLOCKING_SHORTLET_STATUSES,
  canCheckInFromStatus,
} from "@/lib/shortlets-reservation-status";
import { buildNightAuditSnapshot } from "@/lib/shortlets-night-audit";
import {
  assignShortletUnitPropertySchema,
  assignShortletReservationApartmentSchema,
  completeShortletCheckoutInspectionSchema,
  createShortletBookingBatchSchema,
  createShortletReservationSchema,
  createShortletUnitSchema,
  importChannelLeadSchema,
  listAvailableShortletApartmentsSchema,
  postShortletFolioSchema,
  recordShortletPaymentSchema,
  saveShortletGuestSchema,
  saveShortletPmsSettingsSchema,
  saveShortletPropertySchema,
  saveShortletServiceItemSchema,
  saveShortletUnitSchema,
  updateHousekeepingStatusSchema,
} from "@/lib/validators/shortlet";
import { createTenantUploadSignature, type CloudinaryUploadError } from "@/lib/cloudinary-upload-server";
import type { CloudinaryUploadSignature } from "@/lib/cloudinary-upload-client";
import { revalidateShortletsPaths } from "@/lib/shortlets-loaders";
import { revalidatePath } from "next/cache";

type ActionResult =
  | { ok: true; businessDayId?: string; reservationId?: string; reservationIds?: string[]; guestId?: string }
  | { ok: false; error: string };

async function getTenantAndMembership(tenantSlug: string, userId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      slug: true,
      defaultCurrency: true,
      settings: {
        select: {
          shortletFinanceSync: true,
          moduleFinance: true,
        },
      },
    },
  });
  if (!tenant) return { tenant: null, membership: null };
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId } },
    select: { status: true, role: true, modulePermissions: true },
  });
  return { tenant, membership };
}

function financeSyncEnabled(tenant: {
  settings: { shortletFinanceSync?: boolean | null; moduleFinance?: boolean | null } | null;
}) {
  return Boolean(tenant.settings?.moduleFinance && tenant.settings?.shortletFinanceSync);
}

function accessCtx(
  isPlatformAdmin: boolean,
  membership: { status: MembershipStatus; role: MembershipRole; modulePermissions?: unknown } | null,
): ShortletsAccessContext {
  return { isPlatformAdmin, membership };
}

function revalidateAll(tenantSlug: string) {
  for (const path of revalidateShortletsPaths(tenantSlug)) {
    revalidatePath(path);
  }
  revalidatePath(`/${tenantSlug}/finance`);
  revalidatePath(`/${tenantSlug}/clients`);
}

export async function createShortletUnit(
  tenantSlug: string,
  input: {
    source?: "CUSTOM" | "PROJECT_UNIT";
    projectUnitId?: string;
    propertyId?: string;
    name?: string;
    location?: string;
    floor?: string;
    roomLayout?: string;
    sizeSqFt?: number;
    maxOccupancy?: number;
    description?: string;
    amenities?: string[];
    listingStatus?: "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE";
    isActive?: boolean;
    nightlyRate: number;
    cleaningFee?: number;
    cautionFee?: number;
    currency: string;
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const parsed = createShortletUnitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortLets(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to manage short lets." };
  }

  let projectUnitMeta: { id: string; label: string; unitType: string | null; projectName: string } | null =
    null;
  if (parsed.data.source === "PROJECT_UNIT") {
    if (!parsed.data.projectUnitId) return { ok: false, error: "Select a project unit to link." };
    const projectUnit = await prisma.unit.findFirst({
      where: { id: parsed.data.projectUnitId, tenantId: tenant.id },
      select: {
        id: true,
        label: true,
        unitType: true,
        shortletUnit: { select: { id: true } },
        project: { select: { name: true } },
      },
    });
    if (!projectUnit) return { ok: false, error: "Project unit not found." };
    if (projectUnit.shortletUnit)
      return { ok: false, error: "Project unit already linked to a short let unit." };
    projectUnitMeta = {
      id: projectUnit.id,
      label: projectUnit.label,
      unitType: projectUnit.unitType,
      projectName: projectUnit.project.name,
    };
  }

  const name =
    parsed.data.source === "PROJECT_UNIT" && projectUnitMeta
      ? `${projectUnitMeta.projectName} · ${projectUnitMeta.label}`
      : (parsed.data.name || "").trim();
  const location =
    parsed.data.source === "PROJECT_UNIT" && projectUnitMeta
      ? projectUnitMeta.projectName
      : parsed.data.location || null;

  await prisma.shortletUnit.create({
    data: {
      tenantId: tenant.id,
      propertyId: parsed.data.propertyId || null,
      projectUnitId: projectUnitMeta?.id || null,
      name,
      location,
      floor: parsed.data.floor || null,
      roomLayout: parsed.data.roomLayout || projectUnitMeta?.unitType || null,
      sizeSqFt: parsed.data.sizeSqFt ?? null,
      maxOccupancy: parsed.data.maxOccupancy ?? null,
      description: parsed.data.description || null,
      amenities: parsed.data.amenities?.length ? parsed.data.amenities : undefined,
      listingStatus: (parsed.data.listingStatus || "AVAILABLE") as ShortletListingStatus,
      isActive: parsed.data.isActive ?? true,
      nightlyRate: parsed.data.nightlyRate,
      cleaningFee: parsed.data.cleaningFee ?? null,
      cautionFee: parsed.data.cautionFee ?? null,
      currency: parsed.data.currency.toUpperCase(),
      housekeepingStatus: ShortletHousekeepingStatus.VACANT_CLEAN,
    },
  });
  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "SHORTLETS",
    entityType: "APARTMENT",
    action: "CREATE",
    summary: `Created apartment ${name}.`,
  });
  revalidateAll(tenantSlug);
  return { ok: true };
}

export async function saveShortletUnit(
  tenantSlug: string,
  input: {
    id: string;
    propertyId?: string;
    name: string;
    floor?: string;
    roomLayout?: string;
    sizeSqFt?: number;
    maxOccupancy?: number;
    description?: string;
    amenities?: string[];
    listingStatus: "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE";
    isActive?: boolean;
    nightlyRate: number;
    cleaningFee?: number;
    cautionFee?: number;
    currency: string;
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const parsed = saveShortletUnitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortLets(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to manage apartments." };
  }

  const existing = await prisma.shortletUnit.findFirst({
    where: { id: parsed.data.id, tenantId: tenant.id },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Apartment not found." };

  if (parsed.data.propertyId) {
    const property = await prisma.shortletProperty.findFirst({
      where: { id: parsed.data.propertyId, tenantId: tenant.id },
      select: { id: true, name: true },
    });
    if (!property) return { ok: false, error: "Location not found." };
  }

  await prisma.shortletUnit.update({
    where: { id: existing.id },
    data: {
      propertyId: parsed.data.propertyId || null,
      name: parsed.data.name,
      floor: parsed.data.floor || null,
      roomLayout: parsed.data.roomLayout || null,
      sizeSqFt: parsed.data.sizeSqFt ?? null,
      maxOccupancy: parsed.data.maxOccupancy ?? null,
      description: parsed.data.description || null,
      amenities: parsed.data.amenities?.length ? parsed.data.amenities : undefined,
      listingStatus: parsed.data.listingStatus as ShortletListingStatus,
      isActive: parsed.data.isActive ?? true,
      nightlyRate: parsed.data.nightlyRate,
      cleaningFee: parsed.data.cleaningFee ?? null,
      cautionFee: parsed.data.cautionFee ?? null,
      currency: parsed.data.currency.toUpperCase(),
    },
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "SHORTLETS",
    entityType: "APARTMENT",
    entityId: existing.id,
    action: "UPDATE",
    summary: `Updated apartment ${parsed.data.name}.`,
  });

  revalidateAll(tenantSlug);
  return { ok: true };
}

export async function getShortletGuestUploadSignature(
  tenantSlug: string,
  input?: { fileName?: string },
): Promise<CloudinaryUploadSignature | CloudinaryUploadError> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortLets(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to upload guest documents." };
  }
  return createTenantUploadSignature({
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    area: "shortlets",
    fileName: input?.fileName,
  });
}

export async function saveShortletGuest(
  tenantSlug: string,
  input: Record<string, unknown>,
): Promise<ActionResult & { guestId?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const parsed = saveShortletGuestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortLets(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to manage guests." };
  }

  const firstName = parsed.data.firstName.trim();
  const lastName = parsed.data.lastName?.trim() || null;
  const fullName = lastName ? `${firstName} ${lastName}` : firstName;
  const email = parsed.data.email?.trim() || null;
  const phone = parsed.data.phone?.trim() || null;

  if (email || phone) {
    const duplicate = await prisma.shortletGuest.findFirst({
      where: {
        tenantId: tenant.id,
        id: parsed.data.id ? { not: parsed.data.id } : undefined,
        OR: [
          ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      select: { id: true, fullName: true },
    });
    if (duplicate) {
      return { ok: false, error: `A guest with this contact already exists (${duplicate.fullName}).` };
    }
  }

  const data = {
    firstName,
    lastName,
    fullName,
    email,
    phone,
    guestType: parsed.data.guestType as ShortletGuestType,
    idType: parsed.data.idType?.trim() || null,
    idNumber: parsed.data.idNumber?.trim() || null,
    idDocumentUrl: parsed.data.idDocumentUrl?.trim() || null,
    addressLine: parsed.data.addressLine?.trim() || null,
    city: parsed.data.city?.trim() || null,
    state: parsed.data.state?.trim() || null,
    country: parsed.data.country?.trim() || "Nigeria",
    notes: parsed.data.notes?.trim() || null,
  };

  let guestId = parsed.data.id?.trim() || "";
  if (guestId) {
    const existing = await prisma.shortletGuest.findFirst({
      where: { id: guestId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "Guest not found." };
    await prisma.shortletGuest.update({ where: { id: guestId }, data });
  } else {
    const created = await prisma.shortletGuest.create({
      data: { tenantId: tenant.id, ...data },
      select: { id: true },
    });
    guestId = created.id;
  }

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "SHORTLETS",
    entityType: "GUEST",
    entityId: guestId,
    action: parsed.data.id ? "UPDATE" : "CREATE",
    summary: `${parsed.data.id ? "Updated" : "Created"} guest ${fullName}.`,
  });

  revalidateAll(tenantSlug);
  return { ok: true, guestId };
}

export async function listAvailableShortletApartments(
  tenantSlug: string,
  input: Record<string, unknown>,
): Promise<
  | {
      ok: true;
      apartments: Array<{
        id: string;
        label: string;
        propertyId: string | null;
        propertyName: string;
        nightlyRate: number;
        cleaningFee: number;
        cautionFee: number | null;
        currency: string;
      }>;
    }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const parsed = listAvailableShortletApartmentsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortLets(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission." };
  }

  const checkIn = new Date(`${parsed.data.checkIn}T${parsed.data.checkInTime}:00`);
  const checkOut = new Date(`${parsed.data.checkOut}T${parsed.data.checkOutTime}:00`);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
    return { ok: false, error: "Invalid stay dates." };
  }

  const propertyId = parsed.data.propertyId?.trim() || null;
  const units = await prisma.shortletUnit.findMany({
    where: {
      tenantId: tenant.id,
      isActive: true,
      listingStatus: ShortletListingStatus.AVAILABLE,
      ...(propertyId ? { propertyId } : {}),
      ...(parsed.data.walkInOnly ? { housekeepingStatus: ShortletHousekeepingStatus.VACANT_CLEAN } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      propertyId: true,
      nightlyRate: true,
      cleaningFee: true,
      cautionFee: true,
      currency: true,
      property: { select: { name: true } },
    },
  });

  const blocked = await prisma.shortletReservation.findMany({
    where: {
      tenantId: tenant.id,
      status: { in: BLOCKING_SHORTLET_STATUSES },
      unitId: { in: units.map((u) => u.id) },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
    select: { unitId: true },
  });
  const blockedIds = new Set(blocked.map((b) => b.unitId).filter(Boolean));

  const apartments = units
    .filter((u) => !blockedIds.has(u.id))
    .map((u) => ({
      id: u.id,
      label: u.property?.name ? `${u.name} · ${u.property.name}` : u.name,
      propertyId: u.propertyId,
      propertyName: u.property?.name || "",
      nightlyRate: Number(u.nightlyRate),
      cleaningFee: Number(u.cleaningFee || 0),
      cautionFee: u.cautionFee != null ? Number(u.cautionFee) : null,
      currency: u.currency,
    }));

  return { ok: true, apartments };
}

export async function createShortletReservation(
  tenantSlug: string,
  input: {
    guestId?: string;
    unitId?: string;
    propertyId?: string;
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;
    guestCount?: number;
    checkIn: string;
    checkInTime: string;
    checkOut: string;
    checkOutTime: string;
    notes?: string;
    cautionFee?: number;
    isWalkIn?: boolean;
    checkInImmediately?: boolean;
    collectPaymentNow?: boolean;
    paymentAmount?: number;
    cautionFeePaid?: number;
    paymentPaidAt?: string;
    paymentMethod?: string;
    paymentReference?: string;
    paymentNote?: string;
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const parsed = createShortletReservationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortLets(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to create reservations." };
  }

  const checkIn = new Date(`${parsed.data.checkIn}T${parsed.data.checkInTime}:00`);
  const checkOut = new Date(`${parsed.data.checkOut}T${parsed.data.checkOutTime}:00`);
  const ms = checkOut.getTime() - checkIn.getTime();
  const nights = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || nights <= 0) {
    return { ok: false, error: "Invalid check-in/check-out dates." };
  }

  const isWalkIn = parsed.data.isWalkIn === true || parsed.data.checkInImmediately === true;
  const unitId = parsed.data.unitId?.trim() || null;
  const propertyId = parsed.data.propertyId?.trim() || null;

  let guestName = parsed.data.guestName?.trim() || "";
  let guestEmail = parsed.data.guestEmail?.trim() || null;
  let guestPhone = parsed.data.guestPhone?.trim() || null;
  let resolvedGuestId: string | null = parsed.data.guestId?.trim() || null;

  if (resolvedGuestId) {
    const guest = await prisma.shortletGuest.findFirst({
      where: { id: resolvedGuestId, tenantId: tenant.id },
      select: { id: true, fullName: true, email: true, phone: true },
    });
    if (!guest) return { ok: false, error: "Guest not found." };
    guestName = guest.fullName;
    guestEmail = guest.email;
    guestPhone = guest.phone;
  } else if (!guestName) {
    return { ok: false, error: "Select a guest or enter a guest name." };
  }

  if (isWalkIn && !unitId) {
    return { ok: false, error: "Walk-in check-in requires an apartment." };
  }

  let unit: {
    id: string;
    name: string;
    nightlyRate: unknown;
    cleaningFee: unknown;
    cautionFee: unknown;
    currency: string;
    housekeepingStatus: ShortletHousekeepingStatus;
  } | null = null;

  if (unitId) {
    unit = await prisma.shortletUnit.findFirst({
      where: { id: unitId, tenantId: tenant.id },
      select: {
        id: true,
        name: true,
        nightlyRate: true,
        cleaningFee: true,
        cautionFee: true,
        currency: true,
        housekeepingStatus: true,
      },
    });
    if (!unit) return { ok: false, error: "Apartment not found." };

    if (isWalkIn && unit.housekeepingStatus !== ShortletHousekeepingStatus.VACANT_CLEAN) {
      return { ok: false, error: "Walk-in check-in requires a clean vacant apartment." };
    }

    const overlap = await prisma.shortletReservation.findFirst({
      where: {
        tenantId: tenant.id,
        unitId: unit.id,
        status: { in: BLOCKING_SHORTLET_STATUSES },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: { id: true },
    });
    if (overlap)
      return { ok: false, error: "Selected dates overlap an existing reservation on this apartment." };
  }

  if (propertyId && !unit) {
    const property = await prisma.shortletProperty.findFirst({
      where: { id: propertyId, tenantId: tenant.id, isActive: true },
      select: { id: true },
    });
    if (!property) return { ok: false, error: "Location not found." };
  }

  const nightly = unit ? Number(unit.nightlyRate) : 0;
  const cleaning = unit ? Number(unit.cleaningFee || 0) : 0;
  const cautionFee =
    parsed.data.cautionFee != null
      ? parsed.data.cautionFee
      : unit?.cautionFee != null
        ? Number(unit.cautionFee)
        : null;
  const totalAmount = unit ? nightly * nights + cleaning : 0;
  const currency = unit?.currency || tenant.defaultCurrency;
  const initialPayment = parsed.data.collectPaymentNow ? Number(parsed.data.paymentAmount || 0) : 0;
  const cautionFeePaid = parsed.data.collectPaymentNow ? Number(parsed.data.cautionFeePaid || 0) : 0;
  if (initialPayment < 0) return { ok: false, error: "Initial payment cannot be negative." };
  if (cautionFeePaid < 0) return { ok: false, error: "Caution fee paid cannot be negative." };
  if (initialPayment > totalAmount)
    return { ok: false, error: "Booking payment cannot exceed reservation total." };
  if (cautionFee != null && cautionFeePaid > cautionFee) {
    return { ok: false, error: "Caution fee paid cannot exceed the caution fee." };
  }
  if (isWalkIn && parsed.data.collectPaymentNow && totalAmount > 0 && initialPayment < totalAmount) {
    return { ok: false, error: "Walk-in policy: collect the full booking amount before check-in." };
  }
  const initialPaidAt =
    parsed.data.collectPaymentNow && initialPayment > 0 ? new Date(parsed.data.paymentPaidAt || "") : null;
  if (initialPaidAt && Number.isNaN(initialPaidAt.getTime())) {
    return { ok: false, error: "Invalid initial payment date." };
  }

  const reservationStatus = isWalkIn
    ? ShortletReservationStatus.CHECKED_IN
    : ShortletReservationStatus.CONFIRMED;
  const source = isWalkIn ? ShortletReservationSource.WALK_IN : ShortletReservationSource.DIRECT;

  const noteLines: string[] = [];
  if (parsed.data.guestCount && parsed.data.guestCount > 1) {
    noteLines.push(`Guests: ${parsed.data.guestCount}`);
  }
  if (parsed.data.notes?.trim()) noteLines.push(parsed.data.notes.trim());
  const combinedNotes = noteLines.length > 0 ? noteLines.join("\n") : null;

  let reservationId = "";
  await prisma.$transaction(async (tx) => {
    if (!resolvedGuestId) {
      resolvedGuestId = await findOrCreateShortletGuest(tx, {
        tenantId: tenant.id,
        guestName,
        guestEmail,
        guestPhone,
      });
    }
    const bookingNumber = await nextShortletBookingNumber(tx, tenant.id);

    const reservation = await tx.shortletReservation.create({
      data: {
        tenantId: tenant.id,
        unitId: unit?.id || null,
        propertyId: propertyId || null,
        guestId: resolvedGuestId,
        bookingNumber,
        guestName,
        guestEmail,
        guestPhone,
        checkIn,
        checkOut,
        nights,
        totalAmount,
        amountPaid: initialPayment,
        balanceDue: totalAmount - initialPayment,
        cautionFee,
        cautionFeePaid,
        currency,
        status: reservationStatus,
        source,
        isWalkIn,
        notes: combinedNotes,
        createdByUserId: session.user.id,
        createdByLabel: session.user.name || session.user.email || "Unknown",
      },
    });
    reservationId = reservation.id;

    if (isWalkIn && unit) {
      await tx.shortletUnit.update({
        where: { id: unit.id },
        data: {
          activeReservationId: reservation.id,
          housekeepingStatus: ShortletHousekeepingStatus.OCCUPIED,
        },
      });
    }

    if (parsed.data.collectPaymentNow && initialPayment > 0) {
      const payment = await tx.shortletPayment.create({
        data: {
          tenantId: tenant.id,
          reservationId: reservation.id,
          amount: initialPayment,
          currency,
          paidAt: initialPaidAt as Date,
          method: parsed.data.paymentMethod || null,
          reference: parsed.data.paymentReference || null,
          note: parsed.data.paymentNote || "Recorded at reservation creation.",
          recordedByUserId: session.user.id,
          recordedByLabel: session.user.name || session.user.email || "Unknown",
        },
      });

      if (financeSyncEnabled(tenant)) {
        await syncShortletPaymentToFinance(tx, {
          tenantId: tenant.id,
          paymentId: payment.id,
          guestName,
          amount: initialPayment,
          currency,
          paidAt: initialPaidAt as Date,
          method: parsed.data.paymentMethod,
          reference: parsed.data.paymentReference,
          actorUserId: session.user.id,
          actorLabel: session.user.name || session.user.email || "Unknown",
        });
      }
    }
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "SHORTLETS",
    entityType: "RESERVATION",
    entityId: reservationId,
    action: isWalkIn ? "WALK_IN_CHECK_IN" : "CREATE",
    summary: `${isWalkIn ? "Walk-in check-in" : "Created reservation"} for ${guestName}${unit ? ` on ${unit.name}` : " (apartment to be assigned)"}.`,
  });

  revalidateAll(tenantSlug);
  return { ok: true, reservationId, guestId: resolvedGuestId || undefined };
}

export async function createShortletBookings(
  tenantSlug: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const parsed = createShortletBookingBatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortLets(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to create reservations." };
  }

  const guest = await prisma.shortletGuest.findFirst({
    where: { id: parsed.data.guestId, tenantId: tenant.id },
    select: { id: true, fullName: true, email: true, phone: true },
  });
  if (!guest) return { ok: false, error: "Guest not found." };

  const isWalkIn = parsed.data.isWalkIn === true || parsed.data.checkInImmediately === true;
  const reservationIds: string[] = [];
  let grandTotal = 0;
  let grandCaution = 0;
  const stayCalcs: Array<{
    unit: {
      id: string;
      name: string;
      nightlyRate: unknown;
      cleaningFee: unknown;
      cautionFee: unknown;
      currency: string;
      housekeepingStatus: ShortletHousekeepingStatus;
    } | null;
    propertyId: string | null;
    checkIn: Date;
    checkOut: Date;
    nights: number;
    totalAmount: number;
    cautionFee: number | null;
    currency: string;
  }> = [];

  for (const stay of parsed.data.stays) {
    const checkIn = new Date(`${stay.checkIn}T${stay.checkInTime}:00`);
    const checkOut = new Date(`${stay.checkOut}T${stay.checkOutTime}:00`);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || nights <= 0) {
      return { ok: false, error: "Invalid check-in/check-out dates on one of the stays." };
    }

    const unitId = stay.unitId?.trim() || null;
    const propertyId = stay.propertyId?.trim() || null;
    let unit: (typeof stayCalcs)[number]["unit"] = null;

    if (unitId) {
      unit = await prisma.shortletUnit.findFirst({
        where: { id: unitId, tenantId: tenant.id },
        select: {
          id: true,
          name: true,
          nightlyRate: true,
          cleaningFee: true,
          cautionFee: true,
          currency: true,
          housekeepingStatus: true,
        },
      });
      if (!unit) return { ok: false, error: "Apartment not found." };
      if (isWalkIn && unit.housekeepingStatus !== ShortletHousekeepingStatus.VACANT_CLEAN) {
        return { ok: false, error: `Walk-in requires a clean vacant apartment (${unit.name}).` };
      }
      const overlap = await prisma.shortletReservation.findFirst({
        where: {
          tenantId: tenant.id,
          unitId: unit.id,
          status: { in: BLOCKING_SHORTLET_STATUSES },
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
        select: { id: true },
      });
      if (overlap) return { ok: false, error: `Dates overlap an existing booking on ${unit.name}.` };
    } else if (propertyId) {
      const property = await prisma.shortletProperty.findFirst({
        where: { id: propertyId, tenantId: tenant.id, isActive: true },
        select: { id: true },
      });
      if (!property) return { ok: false, error: "Location not found." };
    }

    const nightly = unit ? Number(unit.nightlyRate) : 0;
    const cleaning = unit ? Number(unit.cleaningFee || 0) : 0;
    const cautionFee = unit?.cautionFee != null ? Number(unit.cautionFee) : null;
    const totalAmount = unit ? nightly * nights + cleaning : 0;
    const currency = unit?.currency || tenant.defaultCurrency;
    grandTotal += totalAmount;
    grandCaution += cautionFee || 0;
    stayCalcs.push({ unit, propertyId, checkIn, checkOut, nights, totalAmount, cautionFee, currency });
  }

  const initialPayment = parsed.data.collectPaymentNow ? Number(parsed.data.paymentAmount || 0) : 0;
  const cautionFeePaid = parsed.data.collectPaymentNow ? Number(parsed.data.cautionFeePaid || 0) : 0;
  if (isWalkIn && parsed.data.collectPaymentNow && grandTotal > 0 && initialPayment < grandTotal) {
    return { ok: false, error: "Walk-in policy: collect the full booking amount before check-in." };
  }
  if (initialPayment > grandTotal) return { ok: false, error: "Payment exceeds booking total." };
  if (cautionFeePaid > grandCaution)
    return { ok: false, error: "Caution fee paid exceeds total caution fee." };

  const noteLines: string[] = [];
  if (parsed.data.guestCount && parsed.data.guestCount > 1)
    noteLines.push(`Guests: ${parsed.data.guestCount}`);
  if (parsed.data.notes?.trim()) noteLines.push(parsed.data.notes.trim());
  const combinedNotes = noteLines.length > 0 ? noteLines.join("\n") : null;

  const reservationStatus = isWalkIn
    ? ShortletReservationStatus.CHECKED_IN
    : ShortletReservationStatus.CONFIRMED;
  const source = isWalkIn ? ShortletReservationSource.WALK_IN : ShortletReservationSource.DIRECT;
  const initialPaidAt =
    parsed.data.collectPaymentNow && initialPayment > 0 ? new Date(parsed.data.paymentPaidAt || "") : null;
  if (initialPaidAt && Number.isNaN(initialPaidAt.getTime())) {
    return { ok: false, error: "Invalid payment date." };
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < stayCalcs.length; i++) {
      const calc = stayCalcs[i];
      const bookingNumber = await nextShortletBookingNumber(tx, tenant.id);
      const paidShare = stayCalcs.length === 1 ? initialPayment : i === 0 ? initialPayment : 0;
      const cautionShare = stayCalcs.length === 1 ? cautionFeePaid : i === 0 ? cautionFeePaid : 0;

      const reservation = await tx.shortletReservation.create({
        data: {
          tenantId: tenant.id,
          unitId: calc.unit?.id || null,
          propertyId: calc.propertyId,
          guestId: guest.id,
          bookingNumber,
          guestName: guest.fullName,
          guestEmail: guest.email,
          guestPhone: guest.phone,
          checkIn: calc.checkIn,
          checkOut: calc.checkOut,
          nights: calc.nights,
          totalAmount: calc.totalAmount,
          amountPaid: paidShare,
          balanceDue: calc.totalAmount - paidShare,
          cautionFee: calc.cautionFee,
          cautionFeePaid: cautionShare,
          currency: calc.currency,
          status: reservationStatus,
          source,
          isWalkIn,
          notes: combinedNotes,
          createdByUserId: session.user.id,
          createdByLabel: session.user.name || session.user.email || "Unknown",
        },
      });
      reservationIds.push(reservation.id);

      if (isWalkIn && calc.unit) {
        await tx.shortletUnit.update({
          where: { id: calc.unit.id },
          data: {
            activeReservationId: reservation.id,
            housekeepingStatus: ShortletHousekeepingStatus.OCCUPIED,
          },
        });
      }

      if (parsed.data.collectPaymentNow && paidShare > 0 && i === 0) {
        const payment = await tx.shortletPayment.create({
          data: {
            tenantId: tenant.id,
            reservationId: reservation.id,
            amount: paidShare,
            currency: calc.currency,
            paidAt: initialPaidAt as Date,
            method: parsed.data.paymentMethod || null,
            reference: parsed.data.paymentReference || null,
            note: parsed.data.paymentNote || "Recorded at booking creation.",
            recordedByUserId: session.user.id,
            recordedByLabel: session.user.name || session.user.email || "Unknown",
          },
        });
        if (financeSyncEnabled(tenant)) {
          await syncShortletPaymentToFinance(tx, {
            tenantId: tenant.id,
            paymentId: payment.id,
            guestName: guest.fullName,
            amount: paidShare,
            currency: calc.currency,
            paidAt: initialPaidAt as Date,
            method: parsed.data.paymentMethod,
            reference: parsed.data.paymentReference,
            actorUserId: session.user.id,
            actorLabel: session.user.name || session.user.email || "Unknown",
          });
        }
      }
    }
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "SHORTLETS",
    entityType: "RESERVATION",
    action: isWalkIn ? "WALK_IN_CHECK_IN" : "CREATE",
    summary: `${isWalkIn ? "Walk-in" : "Booking"} for ${guest.fullName} — ${stayCalcs.length} stay(s).`,
  });

  revalidateAll(tenantSlug);
  return { ok: true, reservationIds, guestId: guest.id, reservationId: reservationIds[0] };
}

export async function assignShortletReservationApartment(
  tenantSlug: string,
  input: { reservationId: string; unitId: string },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const parsed = assignShortletReservationApartmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortLets(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to assign apartments." };
  }

  const reservation = await prisma.shortletReservation.findFirst({
    where: { id: parsed.data.reservationId, tenantId: tenant.id },
    select: {
      id: true,
      unitId: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      nights: true,
      amountPaid: true,
      status: true,
      cautionFee: true,
    },
  });
  if (!reservation) return { ok: false, error: "Reservation not found." };
  if (reservation.unitId) return { ok: false, error: "This reservation already has an apartment assigned." };
  if (
    reservation.status === ShortletReservationStatus.CHECKED_OUT ||
    reservation.status === ShortletReservationStatus.CANCELLED
  ) {
    return { ok: false, error: "Cannot assign an apartment to a closed reservation." };
  }

  const unit = await prisma.shortletUnit.findFirst({
    where: { id: parsed.data.unitId, tenantId: tenant.id },
    select: {
      id: true,
      name: true,
      nightlyRate: true,
      cleaningFee: true,
      cautionFee: true,
      currency: true,
      propertyId: true,
    },
  });
  if (!unit) return { ok: false, error: "Apartment not found." };

  const overlap = await prisma.shortletReservation.findFirst({
    where: {
      tenantId: tenant.id,
      unitId: unit.id,
      id: { not: reservation.id },
      status: { in: BLOCKING_SHORTLET_STATUSES },
      checkIn: { lt: reservation.checkOut },
      checkOut: { gt: reservation.checkIn },
    },
    select: { id: true },
  });
  if (overlap) return { ok: false, error: "Selected apartment is not available for these dates." };

  const totalAmount = Number(unit.nightlyRate) * reservation.nights + Number(unit.cleaningFee || 0);
  const amountPaid = Number(reservation.amountPaid);
  const cautionFee =
    reservation.cautionFee != null
      ? Number(reservation.cautionFee)
      : unit.cautionFee != null
        ? Number(unit.cautionFee)
        : null;

  await prisma.shortletReservation.update({
    where: { id: reservation.id },
    data: {
      unitId: unit.id,
      propertyId: unit.propertyId,
      totalAmount,
      balanceDue: totalAmount - amountPaid,
      cautionFee,
      currency: unit.currency,
    },
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "SHORTLETS",
    entityType: "RESERVATION",
    entityId: reservation.id,
    action: "ASSIGN_APARTMENT",
    summary: `Assigned ${unit.name} to reservation for ${reservation.guestName}.`,
  });

  revalidateAll(tenantSlug);
  return { ok: true };
}

export async function updateShortletReservationStatus(
  tenantSlug: string,
  reservationId: string,
  status: "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW",
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortLets(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to update reservations." };
  }

  const reservation = await prisma.shortletReservation.findFirst({
    where: { id: reservationId, tenantId: tenant.id },
    select: {
      id: true,
      unitId: true,
      guestName: true,
      guestEmail: true,
      guestPhone: true,
      guestId: true,
      cautionFee: true,
      status: true,
      unit: { select: { housekeepingStatus: true } },
    },
  });
  if (!reservation) return { ok: false, error: "Reservation not found." };

  const nextStatus =
    status === "CONFIRMED"
      ? ShortletReservationStatus.CONFIRMED
      : status === "CHECKED_IN"
        ? ShortletReservationStatus.CHECKED_IN
        : status === "CHECKED_OUT"
          ? ShortletReservationStatus.CHECKED_OUT
          : status === "NO_SHOW"
            ? ShortletReservationStatus.NO_SHOW
            : ShortletReservationStatus.CANCELLED;

  if (status === "CHECKED_IN") {
    if (!canCheckInFromStatus(reservation.status)) {
      return { ok: false, error: "Only pending or confirmed reservations can be checked in." };
    }
    if (!reservation.unitId || !reservation.unit) {
      return { ok: false, error: "Assign an apartment before check-in." };
    }
    if (reservation.unit.housekeepingStatus !== ShortletHousekeepingStatus.VACANT_CLEAN) {
      return { ok: false, error: "Apartment must be clean and vacant before check-in." };
    }
  }

  if (status === "CHECKED_OUT" && !reservation.unitId) {
    return { ok: false, error: "Cannot check out — no apartment assigned to this reservation." };
  }

  const actorLabel = session.user.name || session.user.email || "Unknown";

  await prisma.$transaction(async (tx) => {
    let guestId = reservation.guestId;
    if (!guestId) {
      guestId = await findOrCreateShortletGuest(tx, {
        tenantId: tenant.id,
        guestName: reservation.guestName,
        guestEmail: reservation.guestEmail,
        guestPhone: reservation.guestPhone,
      });
    }

    await tx.shortletReservation.update({
      where: { id: reservation.id },
      data: {
        status: nextStatus,
        ...(guestId !== reservation.guestId ? { guestId } : {}),
      },
    });

    if (nextStatus === ShortletReservationStatus.CHECKED_IN && reservation.unitId) {
      await tx.shortletUnit.update({
        where: { id: reservation.unitId },
        data: {
          housekeepingStatus: ShortletHousekeepingStatus.OCCUPIED,
          activeReservationId: reservation.id,
        },
      });
    } else if (nextStatus === ShortletReservationStatus.CHECKED_OUT && reservation.unitId) {
      await tx.shortletUnit.update({
        where: { id: reservation.unitId },
        data: {
          housekeepingStatus: ShortletHousekeepingStatus.VACANT_DIRTY,
          activeReservationId: null,
        },
      });
      await tx.shortletCheckoutInspection.create({
        data: {
          tenantId: tenant.id,
          reservationId: reservation.id,
          unitId: reservation.unitId,
          status: ShortletInspectionStatus.AWAITING_INSPECTION,
          cautionFeeAmount: reservation.cautionFee != null ? Number(reservation.cautionFee) : null,
        },
      });
    } else if (
      (nextStatus === ShortletReservationStatus.CANCELLED ||
        nextStatus === ShortletReservationStatus.NO_SHOW) &&
      reservation.unitId
    ) {
      await tx.shortletUnit.update({
        where: { id: reservation.unitId },
        data: {
          activeReservationId: null,
          housekeepingStatus:
            reservation.status === ShortletReservationStatus.CHECKED_IN
              ? ShortletHousekeepingStatus.VACANT_DIRTY
              : ShortletHousekeepingStatus.VACANT_CLEAN,
        },
      });
    }
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel,
    module: "SHORTLETS",
    entityType: "RESERVATION",
    entityId: reservation.id,
    action: nextStatus,
    summary: `Marked reservation for ${reservation.guestName} as ${nextStatus}.`,
  });

  revalidateAll(tenantSlug);
  return { ok: true };
}

export async function completeShortletCheckoutInspection(
  tenantSlug: string,
  input: {
    inspectionId: string;
    status: "PASSED" | "FAILED" | "WAIVED";
    condition?: "GOOD" | "DAMAGES_FOUND" | "MAINTENANCE_REQUIRED";
    damageNotes?: string;
    cautionDeduction?: number;
    photoUrls?: string[];
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const parsed = completeShortletCheckoutInspectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortLets(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to complete inspections." };
  }

  const inspection = await prisma.shortletCheckoutInspection.findFirst({
    where: { id: parsed.data.inspectionId, tenantId: tenant.id },
    select: {
      id: true,
      status: true,
      unitId: true,
      cautionFeeAmount: true,
      unit: { select: { name: true } },
      reservation: { select: { guestName: true } },
    },
  });
  if (!inspection) return { ok: false, error: "Inspection not found." };
  if (inspection.status !== ShortletInspectionStatus.AWAITING_INSPECTION) {
    return { ok: false, error: "This inspection is already completed." };
  }

  const cautionAmount = inspection.cautionFeeAmount != null ? Number(inspection.cautionFeeAmount) : 0;
  const deduction = parsed.data.cautionDeduction ?? 0;
  if (deduction > cautionAmount) {
    return { ok: false, error: "Caution deduction cannot exceed the caution fee held." };
  }

  const actorLabel = session.user.name || session.user.email || "Unknown";
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.shortletCheckoutInspection.update({
      where: { id: inspection.id },
      data: {
        status: parsed.data.status as ShortletInspectionStatus,
        condition: parsed.data.condition || null,
        damageNotes: parsed.data.damageNotes || null,
        cautionDeduction: deduction > 0 ? deduction : null,
        cautionRefunded: cautionAmount > 0 ? cautionAmount - deduction : null,
        photoUrls: parsed.data.photoUrls?.length ? parsed.data.photoUrls : undefined,
        inspectedAt: now,
        inspectedByUserId: session.user.id,
        inspectedByLabel: actorLabel,
      },
    });

    if (parsed.data.status === "FAILED") {
      await tx.shortletUnit.update({
        where: { id: inspection.unitId },
        data: { housekeepingStatus: ShortletHousekeepingStatus.OUT_OF_ORDER },
      });
    }
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel,
    module: "SHORTLETS",
    entityType: "INSPECTION",
    entityId: inspection.id,
    action: parsed.data.status,
    summary: `Checkout inspection ${parsed.data.status.toLowerCase()} for ${inspection.reservation.guestName} · ${inspection.unit.name}.`,
  });

  revalidateAll(tenantSlug);
  return { ok: true };
}

export async function updateHousekeepingStatus(
  tenantSlug: string,
  input: { unitId: string; status: "VACANT_CLEAN" | "VACANT_DIRTY" | "OCCUPIED" | "OUT_OF_ORDER" },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const parsed = updateHousekeepingStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageHousekeeping(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to update room status." };
  }

  const unit = await prisma.shortletUnit.findFirst({
    where: { id: parsed.data.unitId, tenantId: tenant.id },
    select: { id: true, name: true, activeReservationId: true, housekeepingStatus: true },
  });
  if (!unit) return { ok: false, error: "Unit not found." };

  const next = parsed.data.status as ShortletHousekeepingStatus;
  if (next !== ShortletHousekeepingStatus.OCCUPIED && unit.activeReservationId) {
    return { ok: false, error: "Cannot change status while a guest is checked in. Check out first." };
  }

  const actorLabel = session.user.name || session.user.email || "Unknown";

  if (
    next === ShortletHousekeepingStatus.VACANT_CLEAN &&
    unit.housekeepingStatus === ShortletHousekeepingStatus.VACANT_DIRTY
  ) {
    const pendingInspection = await prisma.shortletCheckoutInspection.findFirst({
      where: {
        tenantId: tenant.id,
        unitId: unit.id,
        status: ShortletInspectionStatus.AWAITING_INSPECTION,
      },
      select: { id: true },
    });
    if (pendingInspection) {
      return { ok: false, error: "Complete the checkout inspection before marking the room clean." };
    }

    const passedInspection = await prisma.shortletCheckoutInspection.findFirst({
      where: {
        tenantId: tenant.id,
        unitId: unit.id,
        status: { in: [ShortletInspectionStatus.PASSED, ShortletInspectionStatus.WAIVED] },
        housekeepingCompletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.shortletUnit.update({
        where: { id: unit.id },
        data: { housekeepingStatus: next },
      });
      if (passedInspection) {
        await tx.shortletCheckoutInspection.update({
          where: { id: passedInspection.id },
          data: {
            housekeepingCompletedAt: new Date(),
            housekeepingCompletedByLabel: actorLabel,
          },
        });
      }
    });
  } else {
    await prisma.shortletUnit.update({
      where: { id: unit.id },
      data: { housekeepingStatus: next },
    });
  }

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel,
    module: "SHORTLETS",
    entityType: "UNIT",
    entityId: unit.id,
    action: "HOUSEKEEPING_UPDATE",
    summary: `Updated ${unit.name} to ${next}.`,
  });

  revalidateAll(tenantSlug);
  return { ok: true };
}

export async function recordShortletPayment(
  tenantSlug: string,
  reservationId: string,
  input: { amount: number; paidAt: string; method?: string; reference?: string; note?: string },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const parsed = recordShortletPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortLets(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to record payments." };
  }

  const reservation = await prisma.shortletReservation.findFirst({
    where: { id: reservationId, tenantId: tenant.id },
    select: { id: true, balanceDue: true, currency: true, guestName: true, amountPaid: true },
  });
  if (!reservation) return { ok: false, error: "Reservation not found." };
  if (parsed.data.amount > Number(reservation.balanceDue)) {
    return { ok: false, error: "Payment exceeds balance due." };
  }

  const nextBalance = Number(reservation.balanceDue) - parsed.data.amount;
  const nextPaid = Number(reservation.amountPaid) + parsed.data.amount;
  const actorLabel = session.user.name || session.user.email || "Unknown";

  await prisma.$transaction(async (tx) => {
    const payment = await tx.shortletPayment.create({
      data: {
        tenantId: tenant.id,
        reservationId: reservation.id,
        amount: parsed.data.amount,
        currency: reservation.currency,
        paidAt: new Date(parsed.data.paidAt),
        method: parsed.data.method || null,
        reference: parsed.data.reference || null,
        note: parsed.data.note || null,
        recordedByUserId: session.user.id,
        recordedByLabel: actorLabel,
      },
    });
    await tx.shortletReservation.update({
      where: { id: reservation.id },
      data: { amountPaid: nextPaid, balanceDue: nextBalance },
    });

    if (financeSyncEnabled(tenant)) {
      await syncShortletPaymentToFinance(tx, {
        tenantId: tenant.id,
        paymentId: payment.id,
        guestName: reservation.guestName,
        amount: parsed.data.amount,
        currency: reservation.currency,
        paidAt: new Date(parsed.data.paidAt),
        method: parsed.data.method,
        reference: parsed.data.reference,
        actorUserId: session.user.id,
        actorLabel,
      });
    }
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "SHORTLETS",
    entityType: "RESERVATION",
    entityId: reservation.id,
    action: "RECORD_PAYMENT",
    summary: `Recorded payment for ${reservation.guestName}.`,
  });

  revalidateAll(tenantSlug);
  return { ok: true };
}

export async function postShortletFolioCharge(
  tenantSlug: string,
  input: {
    reservationId: string;
    department: "ROOM" | "FNB" | "LAUNDRY" | "LOUNGE" | "GYM" | "OTHER";
    serviceItemId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const parsed = postShortletFolioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canPostFolio(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to post folio charges." };
  }

  const reservation = await prisma.shortletReservation.findFirst({
    where: { id: parsed.data.reservationId, tenantId: tenant.id },
    select: { id: true, guestName: true, currency: true, status: true },
  });
  if (!reservation) return { ok: false, error: "Reservation not found." };
  if (!ACTIVE_FOLIO_STATUSES.includes(reservation.status)) {
    return { ok: false, error: "Folio charges can only be posted to active stays." };
  }

  const amount = parsed.data.quantity * parsed.data.unitPrice;

  await prisma.$transaction(async (tx) => {
    await tx.shortletFolioLine.create({
      data: {
        tenantId: tenant.id,
        reservationId: reservation.id,
        serviceItemId: parsed.data.serviceItemId || null,
        department: parsed.data.department as ShortletFolioDepartment,
        description: parsed.data.description,
        quantity: parsed.data.quantity,
        unitPrice: parsed.data.unitPrice,
        amount,
        currency: reservation.currency,
        postedByUserId: session.user.id,
        postedByLabel: session.user.name || session.user.email || "Unknown",
      },
    });
    await tx.shortletReservation.update({
      where: { id: reservation.id },
      data: {
        totalAmount: { increment: amount },
        balanceDue: { increment: amount },
      },
    });
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "SHORTLETS",
    entityType: "FOLIO",
    entityId: reservation.id,
    action: "POST_CHARGE",
    summary: `Posted ${parsed.data.description} to ${reservation.guestName}'s folio.`,
    metadata: { amount, department: parsed.data.department },
  });

  revalidateAll(tenantSlug);
  return { ok: true };
}

export async function saveShortletServiceItem(
  tenantSlug: string,
  input: {
    id?: string;
    department: "ROOM" | "FNB" | "LAUNDRY" | "LOUNGE" | "GYM" | "OTHER";
    name: string;
    price: number;
    currency: string;
    active?: boolean;
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const parsed = saveShortletServiceItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortletSettings(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to manage service catalog." };
  }

  if (parsed.data.id) {
    const existing = await prisma.shortletServiceItem.findFirst({
      where: { id: parsed.data.id, tenantId: tenant.id },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "Service item not found." };
    await prisma.shortletServiceItem.update({
      where: { id: existing.id },
      data: {
        department: parsed.data.department as ShortletFolioDepartment,
        name: parsed.data.name,
        price: parsed.data.price,
        currency: parsed.data.currency.toUpperCase(),
        active: parsed.data.active ?? true,
      },
    });
  } else {
    await prisma.shortletServiceItem.create({
      data: {
        tenantId: tenant.id,
        department: parsed.data.department as ShortletFolioDepartment,
        name: parsed.data.name,
        price: parsed.data.price,
        currency: parsed.data.currency.toUpperCase(),
        active: parsed.data.active ?? true,
      },
    });
  }

  revalidateAll(tenantSlug);
  return { ok: true };
}

export async function saveShortletPmsSettings(
  tenantSlug: string,
  input: {
    checkInTime: string;
    checkOutTime: string;
    eodTime: string;
    checkoutAlertHours: number;
    financeSync?: boolean;
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const parsed = saveShortletPmsSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortletSettings(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to update PMS settings." };
  }

  await prisma.tenantSettings.update({
    where: { tenantId: tenant.id },
    data: {
      shortletCheckInTime: parsed.data.checkInTime,
      shortletCheckOutTime: parsed.data.checkOutTime,
      shortletEodTime: parsed.data.eodTime,
      shortletCheckoutAlertHours: parsed.data.checkoutAlertHours,
      shortletFinanceSync: parsed.data.financeSync ?? false,
    },
  });

  revalidateAll(tenantSlug);
  return { ok: true };
}

export async function assignHousekeeperToUnit(
  tenantSlug: string,
  input: { unitId: string; userId?: string; label?: string },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageHousekeeping(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to assign housekeepers." };
  }

  const unit = await prisma.shortletUnit.findFirst({
    where: { id: input.unitId, tenantId: tenant.id },
    select: { id: true, name: true },
  });
  if (!unit) return { ok: false, error: "Unit not found." };

  let assignedToUserId: string | null = null;
  let assignedToLabel: string | null = null;
  if (input.userId) {
    const member = await prisma.membership.findFirst({
      where: { tenantId: tenant.id, userId: input.userId, status: MembershipStatus.ACTIVE },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!member) return { ok: false, error: "Team member not found." };
    assignedToUserId = member.user.id;
    assignedToLabel = member.user.name || member.user.email || "Staff";
  }

  await prisma.shortletUnit.update({
    where: { id: unit.id },
    data: { assignedToUserId, assignedToLabel },
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "SHORTLETS",
    entityType: "UNIT",
    entityId: unit.id,
    action: "ASSIGN_HOUSEKEEPER",
    summary: assignedToLabel
      ? `Assigned ${assignedToLabel} to ${unit.name}.`
      : `Cleared housekeeper assignment on ${unit.name}.`,
  });

  revalidateAll(tenantSlug);
  return { ok: true };
}

export async function runShortletEndOfDay(tenantSlug: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortletSettings(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to run end of day." };
  }

  const now = new Date();
  const businessDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const existing = await prisma.shortletBusinessDay.findUnique({
    where: { tenantId_businessDate: { tenantId: tenant.id, businessDate } },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "End of day already closed for today." };

  const [units, reservations, payments, folioLines] = await Promise.all([
    prisma.shortletUnit.findMany({
      where: { tenantId: tenant.id },
      select: { name: true, housekeepingStatus: true },
    }),
    prisma.shortletReservation.findMany({
      where: { tenantId: tenant.id },
      select: {
        guestName: true,
        status: true,
        nights: true,
        totalAmount: true,
        balanceDue: true,
        checkIn: true,
        checkOut: true,
        unit: { select: { name: true } },
      },
    }),
    prisma.shortletPayment.findMany({
      where: { tenantId: tenant.id, paidAt: { gte: businessDate } },
      select: { amount: true },
    }),
    prisma.shortletFolioLine.findMany({
      where: { tenantId: tenant.id, postedAt: { gte: businessDate } },
      select: { amount: true, department: true },
    }),
  ]);

  const closedByLabel = session.user.name || session.user.email || "Unknown";
  const snapshot = buildNightAuditSnapshot({
    currency: tenant.defaultCurrency,
    businessDate,
    closedAt: now,
    closedByLabel,
    units,
    reservations,
    dayPayments: payments,
    dayFolioLines: folioLines,
  });

  let financeReceiptId: string | null = null;
  const businessDay = await prisma.$transaction(async (tx) => {
    const day = await tx.shortletBusinessDay.create({
      data: {
        tenantId: tenant.id,
        businessDate,
        closedAt: now,
        closedByUserId: session.user.id,
        closedByLabel,
        snapshot,
      },
    });

    if (financeSyncEnabled(tenant)) {
      const receipts = await syncDayPaymentsToFinance(tx, {
        tenantId: tenant.id,
        businessDate,
        actorUserId: session.user.id,
        actorLabel: closedByLabel,
      });
      if (receipts.length > 0) {
        financeReceiptId = receipts[receipts.length - 1].id;
        await tx.shortletBusinessDay.update({
          where: { id: day.id },
          data: { financeReceiptId },
        });
      }
    }

    return day;
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: closedByLabel,
    module: "SHORTLETS",
    entityType: "BUSINESS_DAY",
    entityId: businessDay.id,
    action: "EOD_CLOSE",
    summary: `Closed business day ${snapshot.businessDateLabel}. Occupancy ${snapshot.summary.occupancyPercent}%, ADR ${snapshot.summary.adrLabel}.`,
    metadata: {
      occupancyPercent: snapshot.summary.occupancyPercent,
      adr: snapshot.summary.adr,
      inHouseCount: snapshot.summary.inHouseCount,
    },
  });

  revalidateAll(tenantSlug);
  return { ok: true, businessDayId: businessDay.id };
}

export async function saveShortletProperty(
  tenantSlug: string,
  input: {
    id?: string;
    name: string;
    locationCode?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    phone?: string;
    email?: string;
    isActive?: boolean;
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const parsed = saveShortletPropertySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortLets(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to manage locations." };
  }

  const data = {
    name: parsed.data.name,
    locationCode: parsed.data.locationCode || null,
    address: parsed.data.address || null,
    city: parsed.data.city || null,
    state: parsed.data.state || null,
    country: parsed.data.country || "Nigeria",
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    isActive: parsed.data.isActive ?? true,
  };

  if (parsed.data.id) {
    const existing = await prisma.shortletProperty.findFirst({
      where: { id: parsed.data.id, tenantId: tenant.id },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "Location not found." };
    await prisma.shortletProperty.update({ where: { id: parsed.data.id }, data });
  } else {
    const count = await prisma.shortletProperty.count({ where: { tenantId: tenant.id } });
    await prisma.shortletProperty.create({
      data: { tenantId: tenant.id, ...data, sortOrder: count },
    });
  }

  revalidateAll(tenantSlug);
  return { ok: true };
}

export async function deleteShortletProperty(tenantSlug: string, propertyId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortLets(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to delete locations." };
  }

  const property = await prisma.shortletProperty.findFirst({
    where: { id: propertyId, tenantId: tenant.id },
    select: { id: true, name: true, _count: { select: { units: true } } },
  });
  if (!property) return { ok: false, error: "Location not found." };
  if (property._count.units > 0) {
    return { ok: false, error: "Remove or reassign apartments at this location before deleting." };
  }

  await prisma.shortletProperty.delete({ where: { id: property.id } });
  revalidateAll(tenantSlug);
  return { ok: true };
}

export async function assignShortletUnitProperty(
  tenantSlug: string,
  input: { unitId: string; propertyId?: string },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const parsed = assignShortletUnitPropertySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortletSettings(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to assign units." };
  }

  const unit = await prisma.shortletUnit.findFirst({
    where: { id: parsed.data.unitId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!unit) return { ok: false, error: "Unit not found." };

  if (parsed.data.propertyId) {
    const property = await prisma.shortletProperty.findFirst({
      where: { id: parsed.data.propertyId, tenantId: tenant.id, isActive: true },
      select: { id: true },
    });
    if (!property) return { ok: false, error: "Property not found." };
  }

  await prisma.shortletUnit.update({
    where: { id: unit.id },
    data: { propertyId: parsed.data.propertyId || null },
  });

  revalidateAll(tenantSlug);
  return { ok: true };
}

export async function importChannelLeadAsReservation(
  tenantSlug: string,
  input: {
    leadId: string;
    unitId?: string;
    propertyId?: string;
    checkIn: string;
    checkInTime: string;
    checkOut: string;
    checkOutTime: string;
    notes?: string;
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const parsed = importChannelLeadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortLets(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to import channel bookings." };
  }

  const lead = await prisma.lead.findFirst({
    where: { id: parsed.data.leadId, tenantId: tenant.id },
    select: { id: true, name: true, email: true, phone: true, source: true, notes: true },
  });
  if (!lead) return { ok: false, error: "Lead not found." };
  if (!lead.name) return { ok: false, error: "Lead has no guest name." };

  const already = await prisma.shortletReservation.findFirst({
    where: { tenantId: tenant.id, channelLeadId: lead.id },
    select: { id: true },
  });
  if (already) return { ok: false, error: "This inquiry is already linked to a reservation." };

  const checkIn = new Date(`${parsed.data.checkIn}T${parsed.data.checkInTime}:00`);
  const checkOut = new Date(`${parsed.data.checkOut}T${parsed.data.checkOutTime}:00`);
  const ms = checkOut.getTime() - checkIn.getTime();
  const nights = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || nights <= 0) {
    return { ok: false, error: "Invalid check-in/check-out dates." };
  }

  const unitId = parsed.data.unitId?.trim() || null;
  const propertyId = parsed.data.propertyId?.trim() || null;

  let unit: {
    id: string;
    name: string;
    nightlyRate: unknown;
    cleaningFee: unknown;
    cautionFee: unknown;
    currency: string;
    propertyId: string | null;
  } | null = null;

  if (unitId) {
    unit = await prisma.shortletUnit.findFirst({
      where: { id: unitId, tenantId: tenant.id },
      select: {
        id: true,
        name: true,
        nightlyRate: true,
        cleaningFee: true,
        cautionFee: true,
        currency: true,
        propertyId: true,
      },
    });
    if (!unit) return { ok: false, error: "Apartment not found." };

    const overlap = await prisma.shortletReservation.findFirst({
      where: {
        tenantId: tenant.id,
        unitId: unit.id,
        status: { in: BLOCKING_SHORTLET_STATUSES },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: { id: true },
    });
    if (overlap)
      return { ok: false, error: "Selected dates overlap an existing reservation on this apartment." };
  }

  if (propertyId && !unit) {
    const property = await prisma.shortletProperty.findFirst({
      where: { id: propertyId, tenantId: tenant.id, isActive: true },
      select: { id: true },
    });
    if (!property) return { ok: false, error: "Location not found." };
  }

  const totalAmount = unit ? Number(unit.nightlyRate) * nights + Number(unit.cleaningFee || 0) : 0;
  const cautionFee = unit?.cautionFee != null ? Number(unit.cautionFee) : null;
  const currency = unit?.currency || tenant.defaultCurrency;
  const source = lead.source?.toLowerCase().includes("explore")
    ? ShortletReservationSource.EXPLORE
    : ShortletReservationSource.OTA;

  await prisma.$transaction(async (tx) => {
    const guestId = await findOrCreateShortletGuest(tx, {
      tenantId: tenant.id,
      guestName: lead.name!,
      guestEmail: lead.email,
      guestPhone: lead.phone,
    });
    const bookingNumber = await nextShortletBookingNumber(tx, tenant.id);

    await tx.shortletReservation.create({
      data: {
        tenantId: tenant.id,
        unitId: unit?.id || null,
        propertyId: propertyId || unit?.propertyId || null,
        channelLeadId: lead.id,
        guestId,
        bookingNumber,
        guestName: lead.name!,
        guestEmail: lead.email,
        guestPhone: lead.phone,
        checkIn,
        checkOut,
        nights,
        totalAmount,
        amountPaid: 0,
        balanceDue: totalAmount,
        cautionFee,
        currency,
        status: ShortletReservationStatus.PENDING,
        source,
        notes: parsed.data.notes || lead.notes || `Imported from ${lead.source || "channel"}.`,
        createdByUserId: session.user.id,
        createdByLabel: session.user.name || session.user.email || "Unknown",
      },
    });
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "SHORTLETS",
    entityType: "RESERVATION",
    action: "CHANNEL_IMPORT",
    summary: `Imported ${lead.source || "channel"} inquiry for ${lead.name}${unit ? ` on ${unit.name}` : " (apartment TBD)"}.`,
    metadata: { leadId: lead.id },
  });

  revalidateAll(tenantSlug);
  return { ok: true };
}
