"use server";

import { auth } from "@/auth";
import { MembershipRole, MembershipStatus, ShortletReservationStatus, ShortletUnitStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import {
  createShortletReservationSchema,
  createShortletUnitSchema,
  recordShortletPaymentSchema,
} from "@/lib/validators/shortlet";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };

async function getTenantAndMembership(tenantSlug: string, userId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true, defaultCurrency: true },
  });
  if (!tenant) return { tenant: null, membership: null };
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId } },
    select: { status: true, role: true },
  });
  return { tenant, membership };
}

function canManageShortLets(isPlatformAdmin: boolean, membership: { status: MembershipStatus; role: MembershipRole } | null) {
  if (isPlatformAdmin) return true;
  if (!membership || membership.status !== MembershipStatus.ACTIVE) return false;
  return (
    membership.role === MembershipRole.ORG_ADMIN ||
    membership.role === MembershipRole.SALES_MANAGER ||
    membership.role === MembershipRole.FINANCE_MANAGER
  );
}

export async function createShortletUnit(
  tenantSlug: string,
  input: {
    source?: "CUSTOM" | "PROJECT_UNIT";
    projectUnitId?: string;
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
  if (!canManageShortLets(Boolean(session.user.isPlatformAdmin), membership)) {
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
        status: true,
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
      projectUnitId: projectUnitMeta?.id || null,
      name,
      location,
      nightlyRate: parsed.data.nightlyRate,
      cleaningFee: parsed.data.cleaningFee ?? null,
      currency: parsed.data.currency.toUpperCase(),
      status: ShortletUnitStatus.AVAILABLE,
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
  revalidatePath(`/${tenantSlug}/shortlets`);
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
  if (!canManageShortLets(Boolean(session.user.isPlatformAdmin), membership)) {
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

  let reservationId = "";
  await prisma.$transaction(async (tx) => {
    const reservation = await tx.shortletReservation.create({
      data: {
        tenantId: tenant.id,
        unitId: unit.id,
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
        status: ShortletReservationStatus.RESERVED,
        notes: parsed.data.notes || null,
        createdByUserId: session.user.id,
        createdByLabel: session.user.name || session.user.email || "Unknown",
      },
    });
    reservationId = reservation.id;

    await tx.shortletUnit.update({
      where: { id: unit.id },
      data: { activeReservationId: reservation.id, status: ShortletUnitStatus.OCCUPIED },
    });

    if (parsed.data.collectPaymentNow && initialPayment > 0) {
      await tx.shortletPayment.create({
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
    }
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "SHORTLETS",
    entityType: "RESERVATION",
    entityId: reservationId,
    action: "CREATE",
    summary: `Created reservation for ${parsed.data.guestName} on ${unit.name}.`,
  });
  if (parsed.data.collectPaymentNow && initialPayment > 0) {
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "SHORTLETS",
      entityType: "RESERVATION",
      entityId: reservationId,
      action: "RECORD_PAYMENT",
      summary: `Recorded initial payment during reservation creation.`,
      metadata: { amount: initialPayment, method: parsed.data.paymentMethod || null },
    });
  }

  revalidatePath(`/${tenantSlug}/shortlets`);
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
  if (!canManageShortLets(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "No permission to update reservations." };
  }

  const reservation = await prisma.shortletReservation.findFirst({
    where: { id: reservationId, tenantId: tenant.id },
    select: { id: true, unitId: true, guestName: true },
  });
  if (!reservation) return { ok: false, error: "Reservation not found." };

  const nextStatus =
    status === "CHECKED_IN"
      ? ShortletReservationStatus.CHECKED_IN
      : status === "CHECKED_OUT"
        ? ShortletReservationStatus.CHECKED_OUT
        : ShortletReservationStatus.CANCELLED;

  await prisma.$transaction(async (tx) => {
    await tx.shortletReservation.update({
      where: { id: reservation.id },
      data: { status: nextStatus },
    });
    await tx.shortletUnit.update({
      where: { id: reservation.unitId },
      data:
        nextStatus === ShortletReservationStatus.CHECKED_IN
          ? { status: ShortletUnitStatus.OCCUPIED, activeReservationId: reservation.id }
          : { status: ShortletUnitStatus.AVAILABLE, activeReservationId: null },
    });
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

  revalidatePath(`/${tenantSlug}/shortlets`);
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
  if (!canManageShortLets(Boolean(session.user.isPlatformAdmin), membership)) {
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

  await prisma.$transaction(async (tx) => {
    await tx.shortletPayment.create({
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
        recordedByLabel: session.user.name || session.user.email || "Unknown",
      },
    });
    await tx.shortletReservation.update({
      where: { id: reservation.id },
      data: {
        amountPaid: nextPaid,
        balanceDue: nextBalance,
      },
    });
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

  revalidatePath(`/${tenantSlug}/shortlets`);
  return { ok: true };
}
