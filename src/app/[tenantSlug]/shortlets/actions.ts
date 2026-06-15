"use server";

import { auth } from "@/auth";
import {
  MembershipRole,
  MembershipStatus,
  ShortletFolioDepartment,
  ShortletHousekeepingStatus,
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
import { findOrCreateShortletGuestClient } from "@/lib/shortlets-guest-crm";
import { revalidateShortletsPaths } from "@/lib/shortlets-loaders";
import { buildNightAuditSnapshot } from "@/lib/shortlets-night-audit";
import {
  assignShortletUnitPropertySchema,
  createShortletReservationSchema,
  createShortletUnitSchema,
  importChannelLeadSchema,
  postShortletFolioSchema,
  recordShortletPaymentSchema,
  saveShortletPmsSettingsSchema,
  saveShortletPropertySchema,
  saveShortletServiceItemSchema,
  updateHousekeepingStatusSchema,
} from "@/lib/validators/shortlet";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true; businessDayId?: string } | { ok: false; error: string };

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
    select: { status: true, role: true },
  });
  return { tenant, membership };
}

function financeSyncEnabled(tenant: { settings: { shortletFinanceSync?: boolean | null; moduleFinance?: boolean | null } | null }) {
  return Boolean(tenant.settings?.moduleFinance && tenant.settings?.shortletFinanceSync);
}

function accessCtx(isPlatformAdmin: boolean, membership: { status: MembershipStatus; role: MembershipRole } | null): ShortletsAccessContext {
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
    name: string;
    location?: string;
    nightlyRate: number;
    cleaningFee?: number;
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

  let projectUnitMeta: { id: string; label: string; unitType: string | null; projectName: string } | null = null;
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
    if (projectUnit.shortletUnit) return { ok: false, error: "Project unit already linked to a short let unit." };
    projectUnitMeta = { id: projectUnit.id, label: projectUnit.label, unitType: projectUnit.unitType, projectName: projectUnit.project.name };
  }

  const name = parsed.data.source === "PROJECT_UNIT" && projectUnitMeta
    ? `${projectUnitMeta.projectName} · ${projectUnitMeta.label}`
    : (parsed.data.name || "").trim();
  const location = parsed.data.source === "PROJECT_UNIT" && projectUnitMeta
    ? projectUnitMeta.projectName
    : parsed.data.location || null;

  await prisma.shortletUnit.create({
    data: {
      tenantId: tenant.id,
      propertyId: parsed.data.propertyId || null,
      projectUnitId: projectUnitMeta?.id || null,
      name,
      location,
      nightlyRate: parsed.data.nightlyRate,
      cleaningFee: parsed.data.cleaningFee ?? null,
      currency: parsed.data.currency.toUpperCase(),
      housekeepingStatus: ShortletHousekeepingStatus.VACANT_CLEAN,
    },
  });
  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "SHORTLETS",
    entityType: "UNIT",
    action: "CREATE",
    summary: `Created short let unit ${name}.`,
  });
  revalidateAll(tenantSlug);
  return { ok: true };
}

export async function createShortletReservation(
  tenantSlug: string,
  input: {
    unitId: string;
    guestName: string;
    guestEmail?: string;
    guestPhone?: string;
    checkIn: string;
    checkInTime: string;
    checkOut: string;
    checkOutTime: string;
    notes?: string;
    isWalkIn?: boolean;
    collectPaymentNow?: boolean;
    paymentAmount?: number;
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

  const unit = await prisma.shortletUnit.findFirst({
    where: { id: parsed.data.unitId, tenantId: tenant.id },
    select: { id: true, name: true, nightlyRate: true, cleaningFee: true, currency: true, housekeepingStatus: true },
  });
  if (!unit) return { ok: false, error: "Unit not found." };

  const isWalkIn = parsed.data.isWalkIn === true;
  if (isWalkIn && unit.housekeepingStatus !== ShortletHousekeepingStatus.VACANT_CLEAN) {
    return { ok: false, error: "Walk-in check-in requires a clean vacant room." };
  }

  const overlap = await prisma.shortletReservation.findFirst({
    where: {
      tenantId: tenant.id,
      unitId: unit.id,
      status: { in: [ShortletReservationStatus.RESERVED, ShortletReservationStatus.CHECKED_IN] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
    select: { id: true },
  });
  if (overlap) return { ok: false, error: "Selected dates overlap an existing reservation." };

  const nightly = Number(unit.nightlyRate);
  const cleaning = Number(unit.cleaningFee || 0);
  const totalAmount = nightly * nights + cleaning;
  const initialPayment = parsed.data.collectPaymentNow ? Number(parsed.data.paymentAmount || 0) : 0;
  if (initialPayment < 0) return { ok: false, error: "Initial payment cannot be negative." };
  if (initialPayment > totalAmount) return { ok: false, error: "Initial payment cannot exceed reservation total." };
  const initialPaidAt =
    parsed.data.collectPaymentNow && initialPayment > 0
      ? new Date(parsed.data.paymentPaidAt || "")
      : null;
  if (initialPaidAt && Number.isNaN(initialPaidAt.getTime())) {
    return { ok: false, error: "Invalid initial payment date." };
  }

  const reservationStatus = isWalkIn
    ? ShortletReservationStatus.CHECKED_IN
    : ShortletReservationStatus.RESERVED;
  const source = isWalkIn ? ShortletReservationSource.WALK_IN : ShortletReservationSource.DIRECT;

  let reservationId = "";
  await prisma.$transaction(async (tx) => {
    const guestClientId = await findOrCreateShortletGuestClient(tx, {
      tenantId: tenant.id,
      guestName: parsed.data.guestName,
      guestEmail: parsed.data.guestEmail,
      guestPhone: parsed.data.guestPhone,
      activate: isWalkIn,
    });

    const reservation = await tx.shortletReservation.create({
      data: {
        tenantId: tenant.id,
        unitId: unit.id,
        guestClientId,
        guestName: parsed.data.guestName,
        guestEmail: parsed.data.guestEmail || null,
        guestPhone: parsed.data.guestPhone || null,
        checkIn,
        checkOut,
        nights,
        totalAmount,
        amountPaid: initialPayment,
        balanceDue: totalAmount - initialPayment,
        currency: unit.currency,
        status: reservationStatus,
        source,
        isWalkIn,
        notes: parsed.data.notes || null,
        createdByUserId: session.user.id,
        createdByLabel: session.user.name || session.user.email || "Unknown",
      },
    });
    reservationId = reservation.id;

    if (isWalkIn) {
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
          currency: unit.currency,
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
          guestName: parsed.data.guestName,
          amount: initialPayment,
          currency: unit.currency,
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
    summary: `${isWalkIn ? "Walk-in check-in" : "Created reservation"} for ${parsed.data.guestName} on ${unit.name}.`,
  });

  revalidateAll(tenantSlug);
  return { ok: true };
}

export async function updateShortletReservationStatus(
  tenantSlug: string,
  reservationId: string,
  status: "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED",
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
      guestClientId: true,
      status: true,
      unit: { select: { housekeepingStatus: true } },
    },
  });
  if (!reservation) return { ok: false, error: "Reservation not found." };

  const nextStatus =
    status === "CHECKED_IN"
      ? ShortletReservationStatus.CHECKED_IN
      : status === "CHECKED_OUT"
        ? ShortletReservationStatus.CHECKED_OUT
        : ShortletReservationStatus.CANCELLED;

  if (status === "CHECKED_IN" && reservation.unit.housekeepingStatus !== ShortletHousekeepingStatus.VACANT_CLEAN) {
    return { ok: false, error: "Room must be clean and vacant before check-in." };
  }

  await prisma.$transaction(async (tx) => {
    let guestClientId = reservation.guestClientId;
    if (nextStatus === ShortletReservationStatus.CHECKED_IN && !guestClientId) {
      guestClientId = await findOrCreateShortletGuestClient(tx, {
        tenantId: tenant.id,
        guestName: reservation.guestName,
        guestEmail: reservation.guestEmail,
        guestPhone: reservation.guestPhone,
        activate: true,
      });
    }

    await tx.shortletReservation.update({
      where: { id: reservation.id },
      data: {
        status: nextStatus,
        ...(guestClientId && guestClientId !== reservation.guestClientId ? { guestClientId } : {}),
      },
    });

    if (nextStatus === ShortletReservationStatus.CHECKED_IN) {
      await tx.shortletUnit.update({
        where: { id: reservation.unitId },
        data: {
          housekeepingStatus: ShortletHousekeepingStatus.OCCUPIED,
          activeReservationId: reservation.id,
        },
      });
    } else if (nextStatus === ShortletReservationStatus.CHECKED_OUT) {
      await tx.shortletUnit.update({
        where: { id: reservation.unitId },
        data: {
          housekeepingStatus: ShortletHousekeepingStatus.VACANT_DIRTY,
          activeReservationId: null,
        },
      });
    } else {
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
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "SHORTLETS",
    entityType: "RESERVATION",
    entityId: reservation.id,
    action: nextStatus,
    summary: `Marked reservation for ${reservation.guestName} as ${nextStatus}.`,
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
    select: { id: true, name: true, activeReservationId: true },
  });
  if (!unit) return { ok: false, error: "Unit not found." };

  const next = parsed.data.status as ShortletHousekeepingStatus;
  if (next !== ShortletHousekeepingStatus.OCCUPIED && unit.activeReservationId) {
    return { ok: false, error: "Cannot change status while a guest is checked in. Check out first." };
  }

  await prisma.shortletUnit.update({
    where: { id: unit.id },
    data: { housekeepingStatus: next },
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
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
  if (reservation.status !== ShortletReservationStatus.CHECKED_IN && reservation.status !== ShortletReservationStatus.RESERVED) {
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
  input: { id?: string; name: string; address?: string; isActive?: boolean },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const parsed = saveShortletPropertySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageShortletSettings(accessCtx(Boolean(session.user.isPlatformAdmin), membership))) {
    return { ok: false, error: "No permission to manage properties." };
  }

  if (parsed.data.id) {
    const existing = await prisma.shortletProperty.findFirst({
      where: { id: parsed.data.id, tenantId: tenant.id },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "Property not found." };
    await prisma.shortletProperty.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        address: parsed.data.address || null,
        isActive: parsed.data.isActive ?? true,
      },
    });
  } else {
    const count = await prisma.shortletProperty.count({ where: { tenantId: tenant.id } });
    await prisma.shortletProperty.create({
      data: {
        tenantId: tenant.id,
        name: parsed.data.name,
        address: parsed.data.address || null,
        isActive: parsed.data.isActive ?? true,
        sortOrder: count,
      },
    });
  }

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
    unitId: string;
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

  const unit = await prisma.shortletUnit.findFirst({
    where: { id: parsed.data.unitId, tenantId: tenant.id },
    select: { id: true, name: true, nightlyRate: true, cleaningFee: true, currency: true },
  });
  if (!unit) return { ok: false, error: "Unit not found." };

  const overlap = await prisma.shortletReservation.findFirst({
    where: {
      tenantId: tenant.id,
      unitId: unit.id,
      status: { in: [ShortletReservationStatus.RESERVED, ShortletReservationStatus.CHECKED_IN] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
    select: { id: true },
  });
  if (overlap) return { ok: false, error: "Selected dates overlap an existing reservation." };

  const nightly = Number(unit.nightlyRate);
  const cleaning = Number(unit.cleaningFee || 0);
  const totalAmount = nightly * nights + cleaning;
  const source =
    lead.source?.toLowerCase().includes("explore")
      ? ShortletReservationSource.EXPLORE
      : ShortletReservationSource.OTA;

  await prisma.$transaction(async (tx) => {
    const guestClientId = await findOrCreateShortletGuestClient(tx, {
      tenantId: tenant.id,
      guestName: lead.name!,
      guestEmail: lead.email,
      guestPhone: lead.phone,
    });

    await tx.shortletReservation.create({
      data: {
        tenantId: tenant.id,
        unitId: unit.id,
        channelLeadId: lead.id,
        guestClientId,
        guestName: lead.name!,
        guestEmail: lead.email,
        guestPhone: lead.phone,
        checkIn,
        checkOut,
        nights,
        totalAmount,
        amountPaid: 0,
        balanceDue: totalAmount,
        currency: unit.currency,
        status: ShortletReservationStatus.RESERVED,
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
    summary: `Imported ${lead.source || "channel"} inquiry for ${lead.name} on ${unit.name}.`,
    metadata: { leadId: lead.id },
  });

  revalidateAll(tenantSlug);
  return { ok: true };
}
