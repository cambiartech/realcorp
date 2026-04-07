"use server";

import { auth } from "@/auth";
import { InvoiceStatus, MembershipRole, MembershipStatus } from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";
import { createInvoiceInputSchema, recordPaymentInputSchema, updateInvoiceInputSchema } from "@/lib/validators/finance";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };
type FinanceDecision = "APPROVE" | "REJECT";
type EntityLogItem = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  summary: string;
};

async function getTenantAndMembership(tenantSlug: string, userId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true },
  });
  if (!tenant) return { tenant: null, membership: null };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId } },
    select: { status: true, role: true },
  });
  return { tenant, membership };
}

function canManageFinance(
  isPlatformAdmin: boolean,
  membership: { status: MembershipStatus; role: MembershipRole } | null,
) {
  if (isPlatformAdmin) return true;
  if (!membership || membership.status !== MembershipStatus.ACTIVE) return false;
  return membership.role === MembershipRole.ORG_ADMIN || membership.role === MembershipRole.FINANCE_MANAGER;
}

async function canViewAuditDetails(tenantSlug: string, userId: string, isPlatformAdmin: boolean) {
  const { membership } = await getTenantAndMembership(tenantSlug, userId);
  return canManageFinance(isPlatformAdmin, membership);
}

export async function resolvePendingFinance(
  tenantSlug: string,
  dealId: string,
  decision: FinanceDecision,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to manage finance queue." };
  }

  const existing = await prisma.deal.findFirst({
    where: { id: dealId, tenantId: tenant.id },
    select: { id: true, pendingFinance: true },
  });
  if (!existing) return { ok: false, error: "Deal not found." };
  if (!existing.pendingFinance) return { ok: false, error: "This deal is no longer pending finance." };
  if (decision !== "APPROVE" && decision !== "REJECT") {
    return { ok: false, error: "Invalid finance decision." };
  }

  try {
    const reviewerLabel = session.user.name || session.user.email || "Unknown reviewer";
    await prisma.deal.update({
      where: { id: existing.id },
      data: {
        // Queue is resolved by finance; decision is persisted for audit reporting.
        pendingFinance: false,
        financeDecision: decision === "APPROVE" ? "APPROVED" : "REJECTED",
        financeReviewedAt: new Date(),
        financeReviewedByUserId: session.user.id,
        financeReviewedByLabel: reviewerLabel,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: reviewerLabel,
      module: "FINANCE",
      entityType: "DEAL",
      entityId: existing.id,
      action: decision === "APPROVE" ? "FINANCE_APPROVED" : "FINANCE_REJECTED",
      summary: `Finance ${decision.toLowerCase()}d pending check on deal.`,
    });
  } catch {
    return { ok: false, error: "Could not update finance decision right now." };
  }

  revalidatePath(`/${tenantSlug}/finance`);
  revalidatePath(`/${tenantSlug}/deals`);
  return { ok: true };
}

export async function createInvoiceRecord(
  tenantSlug: string,
  input: {
    dealId?: string;
    title: string;
    amount: number;
    currency: string;
    dueDate?: string;
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = createInvoiceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to create invoice records." };
  }

  if (parsed.data.dealId) {
    const deal = await prisma.deal.findFirst({
      where: { id: parsed.data.dealId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!deal) return { ok: false, error: "Selected deal is invalid." };
  }

  const seq = await prisma.invoice.count({ where: { tenantId: tenant.id } });
  const invoiceNumber = `INV-${String(seq + 1).padStart(5, "0")}`;

  try {
    await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        dealId: parsed.data.dealId || null,
        invoiceNumber,
        title: parsed.data.title,
        amount: parsed.data.amount,
        balanceDue: parsed.data.amount,
        currency: parsed.data.currency,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        issuedAt: new Date(),
        createdByUserId: session.user.id,
        createdByLabel: session.user.name || session.user.email || "Unknown creator",
        status: InvoiceStatus.DRAFT,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown creator",
      module: "FINANCE",
      entityType: "INVOICE",
      action: "CREATE",
      summary: `Created draft invoice ${invoiceNumber}.`,
      metadata: {
        invoiceNumber,
        title: parsed.data.title,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
      },
    });
  } catch {
    return { ok: false, error: "Could not create invoice right now." };
  }

  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true };
}

export async function recordInvoicePayment(
  tenantSlug: string,
  invoiceId: string,
  input: {
    amount: number;
    paidAt: string;
    method?: string;
    reference?: string;
    note?: string;
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = recordPaymentInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to record payments." };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId: tenant.id },
    select: { id: true, currency: true, amount: true, balanceDue: true, status: true },
  });
  if (!invoice) return { ok: false, error: "Invoice not found." };
  if (invoice.status === InvoiceStatus.VOID) return { ok: false, error: "Cannot record payment on void invoice." };
  if (Number(invoice.balanceDue) <= 0) return { ok: false, error: "Invoice is already fully paid." };
  if (parsed.data.amount > Number(invoice.balanceDue)) {
    return { ok: false, error: "Payment cannot exceed invoice balance." };
  }

  const nextBalance = Number(invoice.balanceDue) - parsed.data.amount;
  const nextStatus = nextBalance <= 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.paymentRecord.create({
        data: {
          tenantId: tenant.id,
          invoiceId: invoice.id,
          amount: parsed.data.amount,
          currency: invoice.currency,
          paidAt: new Date(parsed.data.paidAt),
          method: parsed.data.method || null,
          reference: parsed.data.reference || null,
          note: parsed.data.note || null,
          recordedByUserId: session.user.id,
          recordedByLabel: session.user.name || session.user.email || "Unknown recorder",
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          balanceDue: nextBalance,
          status: nextStatus,
        },
      });
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown recorder",
      module: "FINANCE",
      entityType: "INVOICE",
      entityId: invoice.id,
      action: "RECORD_PAYMENT",
      summary: `Recorded payment on invoice.`,
      metadata: {
        amount: parsed.data.amount,
        paidAt: parsed.data.paidAt,
        method: parsed.data.method || null,
      },
    });
  } catch {
    return { ok: false, error: "Could not record payment right now." };
  }

  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true };
}

export async function updateInvoiceRecord(
  tenantSlug: string,
  invoiceId: string,
  input: {
    title: string;
    amount: number;
    currency: string;
    dueDate?: string;
    status?: "DRAFT" | "SENT" | "VOID";
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = updateInvoiceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to edit invoices." };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId: tenant.id },
    select: { id: true, amount: true, balanceDue: true, invoiceNumber: true, status: true },
  });
  if (!invoice) return { ok: false, error: "Invoice not found." };

  const paidAmount = Number(invoice.amount) - Number(invoice.balanceDue);
  if (parsed.data.amount < paidAmount) {
    return { ok: false, error: "Amount cannot be lower than already recorded payments." };
  }
  const nextBalance = parsed.data.amount - paidAmount;
  const nextStatus =
    parsed.data.status === "VOID"
      ? InvoiceStatus.VOID
      : nextBalance <= 0
        ? InvoiceStatus.PAID
        : paidAmount > 0
          ? InvoiceStatus.PARTIALLY_PAID
          : ((parsed.data.status as InvoiceStatus | undefined) || InvoiceStatus.SENT);

  try {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        title: parsed.data.title,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        balanceDue: nextStatus === InvoiceStatus.VOID ? 0 : nextBalance,
        status: nextStatus,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown editor",
      module: "FINANCE",
      entityType: "INVOICE",
      entityId: invoice.id,
      action: "UPDATE",
      summary: `Updated invoice ${invoice.invoiceNumber}.`,
      metadata: {
        title: parsed.data.title,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        status: nextStatus,
      },
    });
  } catch {
    return { ok: false, error: "Could not update invoice right now." };
  }

  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true };
}

export async function sendInvoiceRecord(tenantSlug: string, invoiceId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to send invoices." };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId: tenant.id },
    select: { id: true, invoiceNumber: true, status: true },
  });
  if (!invoice) return { ok: false, error: "Invoice not found." };
  if (invoice.status === InvoiceStatus.VOID) return { ok: false, error: "Cannot send a void invoice." };
  if (invoice.status === InvoiceStatus.PAID) return { ok: false, error: "Invoice is already fully paid." };
  if (invoice.status !== InvoiceStatus.DRAFT) return { ok: false, error: "Only draft invoices can be sent." };

  try {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: InvoiceStatus.SENT },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown sender",
      module: "FINANCE",
      entityType: "INVOICE",
      entityId: invoice.id,
      action: "SEND",
      summary: `Sent invoice ${invoice.invoiceNumber}.`,
    });
  } catch {
    return { ok: false, error: "Could not send invoice right now." };
  }

  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true };
}

export async function voidInvoiceRecord(tenantSlug: string, invoiceId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to void invoices." };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId: tenant.id },
    select: { id: true, amount: true, balanceDue: true, invoiceNumber: true, status: true },
  });
  if (!invoice) return { ok: false, error: "Invoice not found." };
  if (invoice.status === InvoiceStatus.VOID) return { ok: false, error: "Invoice is already void." };

  const paidAmount = Number(invoice.amount) - Number(invoice.balanceDue);
  if (paidAmount > 0) {
    return { ok: false, error: "Cannot void an invoice that already has payments. Use adjustments instead." };
  }

  try {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: InvoiceStatus.VOID, balanceDue: 0 },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown user",
      module: "FINANCE",
      entityType: "INVOICE",
      entityId: invoice.id,
      action: "VOID",
      summary: `Voided invoice ${invoice.invoiceNumber}.`,
    });
  } catch {
    return { ok: false, error: "Could not void invoice right now." };
  }

  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true };
}

export async function sendInvoiceReminder(tenantSlug: string, invoiceId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to send reminders." };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId: tenant.id },
    select: { id: true, invoiceNumber: true, status: true, balanceDue: true, dueDate: true },
  });
  if (!invoice) return { ok: false, error: "Invoice not found." };
  if (invoice.status === InvoiceStatus.DRAFT) return { ok: false, error: "Send the invoice before reminders." };
  if (invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.PAID) {
    return { ok: false, error: "Reminders are only available for open invoices." };
  }
  if (Number(invoice.balanceDue) <= 0) return { ok: false, error: "Invoice has no outstanding balance." };

  const latestReminder = await prisma.auditLog.findFirst({
    where: {
      tenantId: tenant.id,
      module: "FINANCE",
      entityType: "INVOICE",
      entityId: invoice.id,
      action: "SEND_REMINDER",
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latestReminder) {
    const msSinceLastReminder = Date.now() - latestReminder.createdAt.getTime();
    if (msSinceLastReminder < 1000 * 60 * 60 * 24) {
      return { ok: false, error: "Reminder already sent in the last 24 hours." };
    }
  }

  try {
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown sender",
      module: "FINANCE",
      entityType: "INVOICE",
      entityId: invoice.id,
      action: "SEND_REMINDER",
      summary: `Sent payment reminder for invoice ${invoice.invoiceNumber}.`,
      metadata: {
        dueDate: invoice.dueDate?.toISOString() || null,
        balanceDue: Number(invoice.balanceDue),
      },
    });
  } catch {
    return { ok: false, error: "Could not send reminder right now." };
  }

  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true };
}

export async function getEntityTimelineLogs(
  tenantSlug: string,
  entityType: string,
  entityId: string,
): Promise<{ ok: true; logs: EntityLogItem[] } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const canView =
    Boolean(session.user.isPlatformAdmin) ||
    Boolean(membership && membership.status === MembershipStatus.ACTIVE);
  if (!canView) return { ok: false, error: "You do not have permission to view logs." };

  const canViewSensitive = await canViewAuditDetails(tenantSlug, session.user.id, Boolean(session.user.isPlatformAdmin));

  const rows = await prisma.auditLog.findMany({
    where: { tenantId: tenant.id, entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const logs: EntityLogItem[] = rows.map((row) => ({
    id: row.id,
    timestamp: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(row.createdAt),
    actor: canViewSensitive ? row.actorLabel || "System" : "Restricted",
    action: row.action,
    summary: canViewSensitive ? row.summary || `${row.module} ${row.action}` : `${row.module} ${row.action}`,
  }));

  return { ok: true, logs };
}
