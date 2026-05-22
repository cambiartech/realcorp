"use server";

import { auth } from "@/auth";
import { BankMatchStatus, InvoiceStatus, MembershipRole, MembershipStatus, Prisma, VendorBillStatus } from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import { createTenantUploadSignature } from "@/lib/cloudinary-upload-server";
import prisma from "@/lib/db";
import { parseFinanceControls } from "@/lib/finance-controls";
import {
  createExpenseInputSchema,
  createInvoiceInputSchema,
  createSalesReceiptInputSchema,
  createVendorBillInputSchema,
  financeControlsInputSchema,
  recordPaymentInputSchema,
  recordVendorBillPaymentInputSchema,
  updateInvoiceInputSchema,
} from "@/lib/validators/finance";
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

type BankStatementRowInput = {
  date?: string;
  description?: string;
  reference?: string;
  debit?: number;
  credit?: number;
  amountAbs: number;
  direction: "debit" | "credit";
};

type ImportBankStatementResult =
  | {
      ok: true;
      rows: Array<{
        id: string;
        importId: string;
        importSourceName: string;
        importImportedAt: string;
        date: string;
        description: string;
        reference: string;
        debit: number;
        credit: number;
        amountAbs: number;
        direction: "debit" | "credit";
        matchStatus: "UNMATCHED" | "MATCHED" | "EXCEPTION";
        matchedEntityType: string | null;
        matchedEntityId: string | null;
        exceptionReason: string | null;
        reconciliationNote: string;
        importIsFinalized: boolean;
      }>;
    }
  | { ok: false; error: string };

type AutoMatchCandidateInput = {
  rowId: string;
  kind: "payment" | "expense";
  entityId: string;
};

type AutoMatchResult =
  | {
      ok: true;
      matched: number;
      skipped: number;
      failed: number;
      details: Array<{ rowId: string; status: "matched" | "skipped" | "failed"; reason: string }>;
    }
  | { ok: false; error: string };

async function isImportFinalized(tenantId: string, importId: string) {
  const imp = await prisma.bankStatementImport.findFirst({
    where: { id: importId, tenantId },
    select: { finalizedAt: true },
  });
  return Boolean(imp?.finalizedAt);
}

function parseLinesList(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/\r?\n|,/g)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  );
}

const DEFAULT_FINANCE_PAYMENT_MODES = ["Bank Transfer", "Cash", "Cheque", "POS"];

function parseListFromFormData(formData: FormData, key: string) {
  const bracket = formData
    .getAll(`${key}[]`)
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  const repeated = formData
    .getAll(key)
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  const merged = [...bracket, ...repeated];
  if (merged.length > 0) return Array.from(new Set(merged));
  return parseLinesList(String(formData.get(key) || ""));
}

/** Reliable catalog lists from Finance Settings (single JSON field per list — avoids FormData multi-value quirks). */
function parseFinanceCatalogJsonField(formData: FormData, fieldName: string): string[] | undefined {
  const raw = formData.get(fieldName);
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  try {
    const parsed = JSON.parse(t) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const strings = parsed
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean);
    const MAX_ITEMS = 200;
    const MAX_LEN = 500;
    const capped = strings.slice(0, MAX_ITEMS).map((s) => (s.length > MAX_LEN ? s.slice(0, MAX_LEN) : s));
    return Array.from(new Set(capped));
  } catch {
    return undefined;
  }
}

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

function parseOptionalDate(raw?: string) {
  const t = String(raw || "").trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d;
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
    department?: string;
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
        department: parsed.data.department || null,
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
        department: parsed.data.department || null,
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
    department?: string;
    method?: string;
    reference?: string;
    note?: string;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentPublicId?: string;
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
          department: parsed.data.department || null,
          paidAt: new Date(parsed.data.paidAt),
          method: parsed.data.method || null,
          reference: parsed.data.reference || null,
          note: parsed.data.note || null,
          attachmentUrl: parsed.data.attachmentUrl || null,
          attachmentName: parsed.data.attachmentName || null,
          attachmentPublicId: parsed.data.attachmentPublicId || null,
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
        department: parsed.data.department || null,
        method: parsed.data.method || null,
        attachmentUrl: parsed.data.attachmentUrl || null,
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
    department?: string;
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
        department: parsed.data.department || null,
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
        department: parsed.data.department || null,
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

export async function sendBulkOverdueReminders(
  tenantSlug: string,
): Promise<{ ok: true; sent: number; skipped: number } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to send reminders." };
  }

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId: tenant.id },
    select: { financeControls: true },
  });
  const controls = parseFinanceControls(settings?.financeControls);
  const now = new Date();

  const openInvoices = await prisma.invoice.findMany({
    where: {
      tenantId: tenant.id,
      status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
      balanceDue: { gt: 0 },
      dueDate: { lt: now },
    },
    select: { id: true, invoiceNumber: true, balanceDue: true, dueDate: true },
    take: 200,
  });

  let sent = 0;
  let skipped = 0;
  for (const invoice of openInvoices) {
    if (!invoice.dueDate) {
      skipped += 1;
      continue;
    }
    const overdueDays = Math.floor((now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    if (overdueDays < controls.firstReminderAfterDays) {
      skipped += 1;
      continue;
    }

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
      const msSince = Date.now() - latestReminder.createdAt.getTime();
      if (msSince < 1000 * 60 * 60 * 24) {
        skipped += 1;
        continue;
      }
    }

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
        dueDate: invoice.dueDate.toISOString(),
        balanceDue: Number(invoice.balanceDue),
        bulk: true,
      },
    });
    sent += 1;
  }

  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true, sent, skipped };
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

export async function createExpenseRecord(
  tenantSlug: string,
  input: {
    category: string;
    department?: string;
    vendorName?: string;
    amount: number;
    currency: string;
    expenseDate: string;
    paidThroughAccount?: string;
    reference?: string;
    note?: string;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentPublicId?: string;
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = createExpenseInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to create expenses." };
  }

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId: tenant.id },
    select: { financeControls: true },
  });
  const controls = parseFinanceControls(settings?.financeControls);
  if (
    controls.expenseApprovalThreshold &&
    parsed.data.amount > controls.expenseApprovalThreshold
  ) {
    return {
      ok: false,
      error: `Expenses above ${controls.expenseApprovalThreshold.toLocaleString()} ${parsed.data.currency} need manager approval before recording.`,
    };
  }

  try {
    const created = await prisma.expense.create({
      data: {
        tenantId: tenant.id,
        category: parsed.data.category,
        department: parsed.data.department || null,
        vendorName: parsed.data.vendorName || null,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        expenseDate: new Date(parsed.data.expenseDate),
        paidThroughAccount: parsed.data.paidThroughAccount || null,
        reference: parsed.data.reference || null,
        note: parsed.data.note || null,
        attachmentUrl: parsed.data.attachmentUrl || null,
        attachmentName: parsed.data.attachmentName || null,
        attachmentPublicId: parsed.data.attachmentPublicId || null,
        createdByUserId: session.user.id,
        createdByLabel: session.user.name || session.user.email || "Unknown recorder",
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown recorder",
      module: "FINANCE",
      entityType: "EXPENSE",
      entityId: created.id,
      action: "CREATE",
      summary: `Created expense ${parsed.data.category}.`,
      metadata: {
        category: parsed.data.category,
        department: parsed.data.department || null,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
      },
    });
  } catch {
    return { ok: false, error: "Could not create expense right now." };
  }

  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true };
}

export async function createVendorBill(
  tenantSlug: string,
  input: {
    vendorName: string;
    title: string;
    amount: number;
    currency: string;
    dueDate?: string;
    department?: string;
    note?: string;
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = createVendorBillInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to create bills." };
  }

  const count = await prisma.vendorBill.count({ where: { tenantId: tenant.id } });
  const billNumber = `BILL-${String(count + 1).padStart(5, "0")}`;

  try {
    const created = await prisma.vendorBill.create({
      data: {
        tenantId: tenant.id,
        billNumber,
        vendorName: parsed.data.vendorName,
        title: parsed.data.title,
        amount: parsed.data.amount,
        balanceDue: parsed.data.amount,
        currency: parsed.data.currency,
        department: parsed.data.department || null,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        note: parsed.data.note || null,
        status: VendorBillStatus.OPEN,
        createdByUserId: session.user.id,
        createdByLabel: session.user.name || session.user.email || "Unknown recorder",
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown recorder",
      module: "FINANCE",
      entityType: "VENDOR_BILL",
      entityId: created.id,
      action: "CREATE",
      summary: `Created vendor bill ${billNumber} for ${parsed.data.vendorName}.`,
      metadata: { amount: parsed.data.amount, currency: parsed.data.currency },
    });
  } catch {
    return { ok: false, error: "Could not create bill right now." };
  }

  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true };
}

export async function recordVendorBillPayment(
  tenantSlug: string,
  billId: string,
  input: {
    amount: number;
    paidAt: string;
    method?: string;
    reference?: string;
    paidThroughAccount?: string;
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = recordVendorBillPaymentInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to record bill payments." };
  }

  const bill = await prisma.vendorBill.findFirst({
    where: { id: billId, tenantId: tenant.id },
    select: { id: true, billNumber: true, balanceDue: true, status: true, currency: true },
  });
  if (!bill) return { ok: false, error: "Bill not found." };
  if (bill.status === VendorBillStatus.VOID || bill.status === VendorBillStatus.PAID) {
    return { ok: false, error: "This bill cannot accept payments." };
  }
  if (parsed.data.amount > Number(bill.balanceDue)) {
    return { ok: false, error: "Payment amount cannot exceed the balance due." };
  }

  const nextBalance = Number(bill.balanceDue) - parsed.data.amount;
  const nextStatus =
    nextBalance <= 0 ? VendorBillStatus.PAID : VendorBillStatus.PARTIAL;

  try {
    await prisma.$transaction([
      prisma.vendorBillPayment.create({
        data: {
          tenantId: tenant.id,
          billId: bill.id,
          amount: parsed.data.amount,
          currency: bill.currency,
          paidAt: new Date(parsed.data.paidAt),
          method: parsed.data.method || null,
          reference: parsed.data.reference || null,
          paidThroughAccount: parsed.data.paidThroughAccount || null,
          recordedByUserId: session.user.id,
          recordedByLabel: session.user.name || session.user.email || "Unknown recorder",
        },
      }),
      prisma.vendorBill.update({
        where: { id: bill.id },
        data: { balanceDue: nextBalance, status: nextStatus },
      }),
    ]);
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown recorder",
      module: "FINANCE",
      entityType: "VENDOR_BILL",
      entityId: bill.id,
      action: "RECORD_PAYMENT",
      summary: `Recorded payment on bill ${bill.billNumber}.`,
      metadata: { amount: parsed.data.amount, balanceRemaining: nextBalance },
    });
  } catch {
    return { ok: false, error: "Could not record payment right now." };
  }

  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true };
}

export async function voidVendorBill(tenantSlug: string, billId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to void bills." };
  }

  const bill = await prisma.vendorBill.findFirst({
    where: { id: billId, tenantId: tenant.id },
    select: { id: true, billNumber: true, status: true },
  });
  if (!bill) return { ok: false, error: "Bill not found." };
  if (bill.status === VendorBillStatus.VOID) return { ok: false, error: "Bill is already void." };
  if (bill.status === VendorBillStatus.PAID || bill.status === VendorBillStatus.PARTIAL) {
    return { ok: false, error: "Bills with payments cannot be voided." };
  }

  try {
    await prisma.vendorBill.update({
      where: { id: bill.id },
      data: { status: VendorBillStatus.VOID, balanceDue: 0 },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown user",
      module: "FINANCE",
      entityType: "VENDOR_BILL",
      entityId: bill.id,
      action: "VOID",
      summary: `Voided vendor bill ${bill.billNumber}.`,
    });
  } catch {
    return { ok: false, error: "Could not void bill right now." };
  }

  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true };
}

export async function getFinanceUploadSignature(
  tenantSlug: string,
  input?: { fileName?: string },
): Promise<
  | {
      ok: true;
      cloudName: string;
      apiKey: string;
      folder: string;
      timestamp: number;
      publicId: string;
      signature: string;
    }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to upload finance files." };
  }

  return createTenantUploadSignature({
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    area: "finance",
    fileName: input?.fileName,
  });
}

export async function createSalesReceiptRecord(
  tenantSlug: string,
  input: {
    dealId?: string;
    title: string;
    customerName?: string;
    amount: number;
    currency: string;
    paymentMode?: string;
    depositAccount?: string;
    reference?: string;
    note?: string;
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = createSalesReceiptInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to create sales receipts." };
  }

  if (parsed.data.dealId) {
    const deal = await prisma.deal.findFirst({
      where: { id: parsed.data.dealId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!deal) return { ok: false, error: "Selected deal is invalid." };
  }

  const seq = await prisma.salesReceipt.count({ where: { tenantId: tenant.id } });
  const receiptNumber = `SR-${String(seq + 1).padStart(5, "0")}`;

  try {
    const created = await prisma.salesReceipt.create({
      data: {
        tenantId: tenant.id,
        dealId: parsed.data.dealId || null,
        receiptNumber,
        title: parsed.data.title,
        customerName: parsed.data.customerName || null,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        paymentMode: parsed.data.paymentMode || null,
        depositAccount: parsed.data.depositAccount || null,
        reference: parsed.data.reference || null,
        note: parsed.data.note || null,
        createdByUserId: session.user.id,
        createdByLabel: session.user.name || session.user.email || "Unknown creator",
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown creator",
      module: "FINANCE",
      entityType: "SALES_RECEIPT",
      entityId: created.id,
      action: "CREATE",
      summary: `Created sales receipt ${receiptNumber}.`,
      metadata: {
        receiptNumber,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
      },
    });
  } catch {
    return { ok: false, error: "Could not create sales receipt right now." };
  }

  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true };
}

export async function importBankStatementRows(
  tenantSlug: string,
  input: { sourceName: string; rows: BankStatementRowInput[] },
): Promise<ImportBankStatementResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to import statements." };
  }

  const rows = (input.rows || [])
    .filter((r) => r && Number(r.amountAbs) > 0 && (r.direction === "debit" || r.direction === "credit"))
    .slice(0, 2000);
  if (rows.length === 0) return { ok: false, error: "No valid statement rows found." };

  try {
    const imported = await prisma.$transaction(async (tx) => {
      const createdImport = await tx.bankStatementImport.create({
        data: {
          tenantId: tenant.id,
          sourceName: input.sourceName?.trim() || "Bank Statement CSV",
          importedByUserId: session.user.id,
          importedByLabel: session.user.name || session.user.email || "Unknown user",
        },
      });

      await tx.bankStatementRow.createMany({
        data: rows.map((row) => ({
          tenantId: tenant.id,
          importId: createdImport.id,
          postedAt: parseOptionalDate(row.date),
          description: row.description?.trim() || null,
          reference: row.reference?.trim() || null,
          debit: row.direction === "debit" ? Math.abs(Number(row.amountAbs || row.debit || 0)) : 0,
          credit: row.direction === "credit" ? Math.abs(Number(row.amountAbs || row.credit || 0)) : 0,
          amountAbs: Math.abs(Number(row.amountAbs)),
          direction: row.direction,
          matchStatus: BankMatchStatus.UNMATCHED,
        })),
      });

      return tx.bankStatementRow.findMany({
        where: { importId: createdImport.id },
        include: {
          import: {
            select: { id: true, sourceName: true, importedAt: true, finalizedAt: true },
          },
        },
        orderBy: [{ postedAt: "asc" }, { createdAt: "asc" }],
        take: 2000,
      });
    });

    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown user",
      module: "FINANCE",
      entityType: "BANK_STATEMENT",
      action: "IMPORT",
      summary: `Imported ${imported.length} bank statement row(s).`,
      metadata: {
        sourceName: input.sourceName?.trim() || "Bank Statement CSV",
        rows: imported.length,
      },
    });

    revalidatePath(`/${tenantSlug}/finance`);
    return {
      ok: true,
      rows: imported.map((r) => ({
        id: r.id,
        importId: r.importId,
        importSourceName: r.import.sourceName,
        importImportedAt: r.import.importedAt.toISOString(),
        date: r.postedAt ? r.postedAt.toISOString().slice(0, 10) : "",
        description: r.description || "",
        reference: r.reference || "",
        debit: Number(r.debit),
        credit: Number(r.credit),
        amountAbs: Number(r.amountAbs),
        direction: r.direction === "debit" ? "debit" : "credit",
        matchStatus: r.matchStatus,
        matchedEntityType: r.matchedEntityType || null,
        matchedEntityId: r.matchedEntityId || null,
        exceptionReason: r.exceptionReason || null,
        reconciliationNote: r.reconciliationNote || "",
        importIsFinalized: Boolean(r.import.finalizedAt),
      })),
    };
  } catch {
    return { ok: false, error: "Could not import bank statement right now." };
  }
}

export async function markBankStatementRowMatched(
  tenantSlug: string,
  rowId: string,
  input: { kind: "payment" | "expense"; entityId: string },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to reconcile statements." };
  }

  const row = await prisma.bankStatementRow.findFirst({
    where: { id: rowId, tenantId: tenant.id },
    select: { id: true, importId: true, amountAbs: true, direction: true, matchStatus: true },
  });
  if (!row) return { ok: false, error: "Statement row not found." };
  if (await isImportFinalized(tenant.id, row.importId)) {
    return { ok: false, error: "This statement batch is finalized and locked." };
  }

  const targetEntityType = input.kind === "payment" ? "PAYMENT" : "EXPENSE";
  const alreadyMatchedElsewhere = await prisma.bankStatementRow.findFirst({
    where: {
      tenantId: tenant.id,
      id: { not: row.id },
      matchStatus: BankMatchStatus.MATCHED,
      matchedEntityType: targetEntityType,
      matchedEntityId: input.entityId,
    },
    select: { id: true },
  });
  if (alreadyMatchedElsewhere) {
    return { ok: false, error: "That record is already matched to another statement row." };
  }

  if (input.kind === "payment") {
    const payment = await prisma.paymentRecord.findFirst({
      where: { id: input.entityId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!payment) return { ok: false, error: "Payment record not found for matching." };
  } else {
    const expense = await prisma.expense.findFirst({
      where: { id: input.entityId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!expense) return { ok: false, error: "Expense record not found for matching." };
  }

  try {
    await prisma.bankStatementRow.update({
      where: { id: row.id },
      data: {
        matchStatus: BankMatchStatus.MATCHED,
        matchedEntityType: targetEntityType,
        matchedEntityId: input.entityId,
        matchedAt: new Date(),
        matchedByUserId: session.user.id,
        matchedByLabel: session.user.name || session.user.email || "Unknown user",
        exceptionReason: null,
      },
    });

    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown user",
      module: "FINANCE",
      entityType: "BANK_STATEMENT_ROW",
      entityId: row.id,
      action: "RECONCILE_MATCH",
      summary: `Matched bank statement row to ${input.kind}.`,
      metadata: {
        amountAbs: Number(row.amountAbs),
        direction: row.direction,
        matchedKind: input.kind,
        matchedEntityId: input.entityId,
      },
    });
  } catch {
    return { ok: false, error: "Could not mark row as matched." };
  }

  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true };
}

export async function unmatchBankStatementRow(
  tenantSlug: string,
  rowId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to unmatch statements." };
  }

  const row = await prisma.bankStatementRow.findFirst({
    where: { id: rowId, tenantId: tenant.id },
    select: { id: true, importId: true, matchStatus: true, matchedEntityType: true, matchedEntityId: true, amountAbs: true, direction: true },
  });
  if (!row) return { ok: false, error: "Statement row not found." };
  if (await isImportFinalized(tenant.id, row.importId)) {
    return { ok: false, error: "This statement batch is finalized and locked." };
  }
  if (row.matchStatus !== BankMatchStatus.MATCHED) return { ok: false, error: "Row is not currently matched." };

  try {
    await prisma.bankStatementRow.update({
      where: { id: row.id },
      data: {
        matchStatus: BankMatchStatus.UNMATCHED,
        matchedEntityType: null,
        matchedEntityId: null,
        matchedAt: null,
        matchedByUserId: null,
        matchedByLabel: null,
        exceptionReason: null,
      },
    });

    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown user",
      module: "FINANCE",
      entityType: "BANK_STATEMENT_ROW",
      entityId: row.id,
      action: "RECONCILE_UNMATCH",
      summary: "Unmatched bank statement row.",
      metadata: {
        amountAbs: Number(row.amountAbs),
        direction: row.direction,
        previousMatchedEntityType: row.matchedEntityType,
        previousMatchedEntityId: row.matchedEntityId,
      },
    });
  } catch {
    return { ok: false, error: "Could not unmatch row right now." };
  }

  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true };
}

export async function autoMatchBankStatementRows(
  tenantSlug: string,
  candidates: AutoMatchCandidateInput[],
): Promise<AutoMatchResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to reconcile statements." };
  }

  const trimmed = (candidates || []).slice(0, 300);
  if (trimmed.length === 0) return { ok: false, error: "No candidates submitted for auto-match." };

  let matched = 0;
  let skipped = 0;
  let failed = 0;
  const details: Array<{ rowId: string; status: "matched" | "skipped" | "failed"; reason: string }> = [];

  for (const c of trimmed) {
    const rowId = String(c.rowId || "");
    const entityId = String(c.entityId || "");
    if (!rowId || !entityId || (c.kind !== "payment" && c.kind !== "expense")) {
      skipped += 1;
      details.push({ rowId, status: "skipped", reason: "Invalid candidate payload." });
      continue;
    }

    const row = await prisma.bankStatementRow.findFirst({
      where: { id: rowId, tenantId: tenant.id },
      select: { id: true, importId: true, amountAbs: true, direction: true, matchStatus: true },
    });
    if (!row) {
      skipped += 1;
      details.push({ rowId, status: "skipped", reason: "Statement row not found." });
      continue;
    }
    if (row.matchStatus === BankMatchStatus.MATCHED) {
      skipped += 1;
      details.push({ rowId, status: "skipped", reason: "Row already matched." });
      continue;
    }
    if (await isImportFinalized(tenant.id, row.importId)) {
      skipped += 1;
      details.push({ rowId, status: "skipped", reason: "Batch is finalized/locked." });
      continue;
    }

    const targetEntityType = c.kind === "payment" ? "PAYMENT" : "EXPENSE";
    const alreadyMatchedElsewhere = await prisma.bankStatementRow.findFirst({
      where: {
        tenantId: tenant.id,
        id: { not: row.id },
        matchStatus: BankMatchStatus.MATCHED,
        matchedEntityType: targetEntityType,
        matchedEntityId: entityId,
      },
      select: { id: true },
    });
    if (alreadyMatchedElsewhere) {
      skipped += 1;
      details.push({ rowId, status: "skipped", reason: "Target already matched to another statement row." });
      continue;
    }

    if (c.kind === "payment") {
      const payment = await prisma.paymentRecord.findFirst({
        where: { id: entityId, tenantId: tenant.id },
        select: { id: true },
      });
      if (!payment) {
        skipped += 1;
        details.push({ rowId, status: "skipped", reason: "Payment not found." });
        continue;
      }
    } else {
      const expense = await prisma.expense.findFirst({
        where: { id: entityId, tenantId: tenant.id },
        select: { id: true },
      });
      if (!expense) {
        skipped += 1;
        details.push({ rowId, status: "skipped", reason: "Expense not found." });
        continue;
      }
    }

    try {
      await prisma.bankStatementRow.update({
        where: { id: row.id },
        data: {
          matchStatus: BankMatchStatus.MATCHED,
          matchedEntityType: targetEntityType,
          matchedEntityId: entityId,
          matchedAt: new Date(),
          matchedByUserId: session.user.id,
          matchedByLabel: session.user.name || session.user.email || "Unknown user",
          exceptionReason: null,
        },
      });

      await writeAuditLog({
        tenantId: tenant.id,
        actorUserId: session.user.id,
        actorLabel: session.user.name || session.user.email || "Unknown user",
        module: "FINANCE",
        entityType: "BANK_STATEMENT_ROW",
        entityId: row.id,
        action: "RECONCILE_MATCH",
        summary: `Matched bank statement row to ${c.kind} (auto-match).`,
        metadata: {
          amountAbs: Number(row.amountAbs),
          direction: row.direction,
          matchedKind: c.kind,
          matchedEntityId: entityId,
          auto: true,
        },
      });
      matched += 1;
      details.push({ rowId, status: "matched", reason: "Matched successfully." });
    } catch {
      failed += 1;
      details.push({ rowId, status: "failed", reason: "Update failed unexpectedly." });
    }
  }

  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true, matched, skipped, failed, details };
}

export async function markBankStatementRowException(
  tenantSlug: string,
  rowId: string,
  reasonCode?: string,
  note?: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to update reconciliation status." };
  }
  const row = await prisma.bankStatementRow.findFirst({
    where: { id: rowId, tenantId: tenant.id },
    select: { id: true, importId: true },
  });
  if (!row) return { ok: false, error: "Statement row not found." };
  if (await isImportFinalized(tenant.id, row.importId)) return { ok: false, error: "This statement batch is finalized and locked." };

  await prisma.bankStatementRow.update({
    where: { id: row.id },
    data: {
      matchStatus: BankMatchStatus.EXCEPTION,
      matchedEntityType: null,
      matchedEntityId: null,
      matchedAt: null,
      matchedByUserId: null,
      matchedByLabel: null,
      exceptionReason: (reasonCode || "").trim() || null,
      reconciliationNote: (note || "").trim() || null,
    },
  });
  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown user",
    module: "FINANCE",
    action: "BANK_EXCEPTION",
    entityType: "BANK_ROW",
    entityId: row.id,
    summary: "Marked statement row as exception",
    metadata: { reasonCode: (reasonCode || "").trim() || null, note: (note || "").trim() || null },
  });
  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true };
}

export async function saveBankStatementRowNote(
  tenantSlug: string,
  rowId: string,
  note?: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to save reconciliation notes." };
  }
  const row = await prisma.bankStatementRow.findFirst({
    where: { id: rowId, tenantId: tenant.id },
    select: { id: true, importId: true },
  });
  if (!row) return { ok: false, error: "Statement row not found." };
  if (await isImportFinalized(tenant.id, row.importId)) return { ok: false, error: "This statement batch is finalized and locked." };

  await prisma.bankStatementRow.update({
    where: { id: row.id },
    data: { reconciliationNote: (note || "").trim() || null },
  });
  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown user",
    module: "FINANCE",
    action: "BANK_NOTE_SAVE",
    entityType: "BANK_ROW",
    entityId: row.id,
    summary: "Saved reconciliation note",
  });
  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true };
}

export async function finalizeBankStatementImport(
  tenantSlug: string,
  importId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to finalize statements." };
  }
  const imp = await prisma.bankStatementImport.findFirst({
    where: { id: importId, tenantId: tenant.id },
    select: { id: true, finalizedAt: true },
  });
  if (!imp) return { ok: false, error: "Import batch not found." };
  if (imp.finalizedAt) return { ok: false, error: "Import batch is already finalized." };

  await prisma.bankStatementImport.update({
    where: { id: imp.id },
    data: {
      finalizedAt: new Date(),
      finalizedByUserId: session.user.id,
      finalizedByLabel: session.user.name || session.user.email || "Unknown user",
    },
  });
  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown user",
    module: "FINANCE",
    action: "BANK_FINALIZE_IMPORT",
    entityType: "BANK_IMPORT",
    entityId: imp.id,
    summary: "Finalized statement import batch",
  });
  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true };
}

export async function saveFinanceSettings(
  tenantSlug: string,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "Only Finance Manager or Org Admin can update finance settings." };
  }

  const financeBankAccounts =
    parseFinanceCatalogJsonField(formData, "financeBankAccountsJson") ??
    parseListFromFormData(formData, "financeBankAccounts");

  const modesFromJson = parseFinanceCatalogJsonField(formData, "financePaymentModesJson");
  const modesFromLegacy = parseListFromFormData(formData, "financePaymentModes");
  const financePaymentModesRaw =
    modesFromJson !== undefined ? modesFromJson : modesFromLegacy.length > 0 ? modesFromLegacy : [];
  const financePaymentModes =
    financePaymentModesRaw.length > 0 ? financePaymentModesRaw : DEFAULT_FINANCE_PAYMENT_MODES;

  const financeCurrenciesRaw =
    parseFinanceCatalogJsonField(formData, "financeCurrenciesJson") ??
    parseListFromFormData(formData, "financeCurrencies");
  const financeCurrencies = financeCurrenciesRaw;

  const controlsParsed = financeControlsInputSchema.safeParse({
    expenseApprovalThreshold: formData.get("expenseApprovalThreshold"),
    firstReminderAfterDays: formData.get("firstReminderAfterDays"),
    secondReminderAfterDays: formData.get("secondReminderAfterDays"),
  });
  const financeControls = controlsParsed.success
    ? {
        expenseApprovalThreshold: controlsParsed.data.expenseApprovalThreshold,
        firstReminderAfterDays: controlsParsed.data.firstReminderAfterDays ?? 7,
        secondReminderAfterDays: controlsParsed.data.secondReminderAfterDays ?? 14,
      }
    : { firstReminderAfterDays: 7, secondReminderAfterDays: 14 };

  const payload = {
    financeBankAccounts: financeBankAccounts as Prisma.InputJsonValue,
    financePaymentModes: financePaymentModes as Prisma.InputJsonValue,
    financeCurrencies: financeCurrencies as Prisma.InputJsonValue,
    financeControls: financeControls as Prisma.InputJsonValue,
  };

  const existing = await prisma.tenantSettings.findUnique({
    where: { tenantId: tenant.id },
    select: { id: true },
  });
  if (existing) {
    await prisma.tenantSettings.update({
      where: { tenantId: tenant.id },
      data: payload,
    });
  } else {
    await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        ...payload,
      },
    });
  }

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown user",
    module: "FINANCE",
    entityType: "SETTINGS",
    action: "UPDATE",
    summary: "Updated finance dropdown settings.",
  });

  revalidatePath(`/${tenantSlug}/finance/settings`);
  revalidatePath(`/${tenantSlug}/finance`);
  revalidatePath(`/${tenantSlug}/settings`);
  return { ok: true };
}
