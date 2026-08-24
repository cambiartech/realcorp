"use server";

import { auth } from "@/auth";
import {
  BankMatchStatus,
  ClientDocumentCategory,
  ClientUnitLinkRole,
  InvoiceStatus,
  MembershipRole,
  MembershipStatus,
  PropertyClientStatus,
} from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import { canManageClients } from "@/lib/clients-access";
import {
  createTenantUploadSignature,
  type CloudinaryUploadError,
  type CloudinaryUploadSignature,
} from "@/lib/cloudinary-upload-server";
import prisma from "@/lib/db";
import {
  addClientDocumentSchema,
  parseCreatePropertyClientForm,
  parseLinkClientUnitForm,
  parseLinkClientShortletForm,
  parseRecordClientDepositForm,
  parseRecordClientEarningForm,
  parseUpdatePropertyClientForm,
} from "@/lib/validators/clients";
import { ensureClientFromDeal } from "@/lib/ensure-client-from-deal";
import { sendPropertyClientPortalInvite } from "@/lib/client-portal-invite";
import { agreedPriceFromCatchUp } from "@/lib/finance-income";
import {
  detectUnitNamePattern,
  groupUnitsByExtractedClient,
  nameLooksGeneric,
  normalizeClientNameKey,
  reservedOwnerNote,
  suggestedClientRole,
  suggestedClientStatus,
  type UnitNamePatternPresetId,
} from "@/lib/unit-label-client-import";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

type CreateClientResult =
  | { ok: true; inviteSent?: boolean; inviteError?: string; alreadyOnPortal?: boolean }
  | { ok: false; error: string };

async function getTenantAndMembership(tenantSlug: string, userId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true },
  });
  if (!tenant) return { tenant: null, membership: null };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId } },
    select: { role: true, status: true },
  });
  return { tenant, membership };
}

function revalidateClients(tenantSlug: string, clientId?: string) {
  revalidatePath(`/${tenantSlug}/clients`);
  if (clientId) revalidatePath(`/${tenantSlug}/clients/${clientId}`);
}

export async function createPropertyClient(
  tenantSlug: string,
  _prev: CreateClientResult | null,
  formData: FormData,
): Promise<CreateClientResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseCreatePropertyClientForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  }

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to add clients." };
  }

  const tenantRecord = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: { id: true, name: true },
  });
  if (!tenantRecord) return { ok: false, error: "Organization not found." };

  let clientId: string;
  try {
    const client = await prisma.propertyClient.create({
      data: {
        tenantId: tenant.id,
        fullName: parsed.data.fullName,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        alternatePhone: parsed.data.alternatePhone || null,
        addressLine: parsed.data.addressLine || null,
        city: parsed.data.city || null,
        state: parsed.data.state || null,
        country: parsed.data.country || "Nigeria",
        status: parsed.data.status ?? PropertyClientStatus.PROSPECT,
        notes: parsed.data.notes || null,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "CLIENTS",
      entityType: "PROPERTY_CLIENT",
      entityId: client.id,
      action: "CREATE",
      summary: `Created client ${client.fullName}.`,
    });
    clientId = client.id;
  } catch {
    return { ok: false, error: "Could not create client right now." };
  }

  revalidateClients(tenantSlug);

  const shouldInvite = parsed.data.sendPortalInvite && parsed.data.email?.trim();
  if (!shouldInvite) return { ok: true };

  const inviteResult = await sendPropertyClientPortalInvite({
    tenantId: tenantRecord.id,
    tenantName: tenantRecord.name,
    email: parsed.data.email!,
    inviterLabel: session.user.name || session.user.email || "Organization admin",
    clientId,
  });

  if (!inviteResult.ok) {
    return { ok: true, inviteError: inviteResult.error };
  }

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "CLIENTS",
    entityType: "INVITATION",
    action: inviteResult.emailSent ? "EMAIL_SENT" : inviteResult.alreadyActive ? "SKIPPED" : "EMAIL_FAILED",
    summary: inviteResult.alreadyActive
      ? `Client ${parsed.data.fullName} already has portal access.`
      : inviteResult.emailSent
        ? `Portal invite sent to ${parsed.data.email}.`
        : `Portal invite email failed for ${parsed.data.email}: ${inviteResult.emailError}`,
    metadata: { email: parsed.data.email, clientId },
  });

  return {
    ok: true,
    inviteSent: inviteResult.emailSent,
    alreadyOnPortal: inviteResult.alreadyActive,
    ...(inviteResult.emailError ? { inviteError: inviteResult.emailError } : {}),
  };
}

export async function updatePropertyClient(
  tenantSlug: string,
  clientId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseUpdatePropertyClientForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  }

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to edit clients." };
  }

  const existing = await prisma.propertyClient.findFirst({
    where: { id: clientId, tenantId: tenant.id },
    select: { id: true, email: true, userId: true },
  });
  if (!existing) return { ok: false, error: "Client not found." };

  const newEmail = parsed.data.email?.trim().toLowerCase() || null;
  const oldEmail = existing.email?.trim().toLowerCase() || null;
  const emailChanged = Boolean(oldEmail && newEmail && oldEmail !== newEmail);

  let clearUserId = false;
  if (emailChanged && existing.userId) {
    const linkedUser = await prisma.user.findUnique({
      where: { id: existing.userId },
      select: { email: true },
    });
    if (linkedUser?.email?.toLowerCase() !== newEmail) {
      clearUserId = true;
    }
  }

  try {
    await prisma.propertyClient.update({
      where: { id: existing.id },
      data: {
        fullName: parsed.data.fullName,
        email: newEmail,
        phone: parsed.data.phone || null,
        alternatePhone: parsed.data.alternatePhone || null,
        addressLine: parsed.data.addressLine || null,
        city: parsed.data.city || null,
        state: parsed.data.state || null,
        country: parsed.data.country || "Nigeria",
        status: parsed.data.status ?? PropertyClientStatus.ACTIVE,
        notes: parsed.data.notes || null,
        ...(clearUserId ? { userId: null } : {}),
      },
    });

    if (emailChanged && oldEmail) {
      const otherClientsWithOldEmail = await prisma.propertyClient.count({
        where: {
          tenantId: tenant.id,
          id: { not: existing.id },
          email: { equals: oldEmail, mode: "insensitive" },
        },
      });
      if (otherClientsWithOldEmail === 0) {
        await prisma.invitation.deleteMany({
          where: {
            tenantId: tenant.id,
            email: oldEmail,
            acceptedAt: null,
            role: { in: [MembershipRole.INVESTOR, MembershipRole.LISTING_OWNER] },
          },
        });
      }
    }
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "CLIENTS",
      entityType: "PROPERTY_CLIENT",
      entityId: existing.id,
      action: "UPDATE",
      summary: `Updated client ${parsed.data.fullName}.`,
    });
  } catch {
    return { ok: false, error: "Could not update client right now." };
  }

  revalidateClients(tenantSlug, clientId);
  return { ok: true };
}

export async function linkClientUnit(
  tenantSlug: string,
  clientId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseLinkClientUnitForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  }

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const client = await prisma.propertyClient.findFirst({
    where: { id: clientId, tenantId: tenant.id },
    select: { id: true, fullName: true },
  });
  if (!client) return { ok: false, error: "Client not found." };

  const unit = await prisma.unit.findFirst({
    where: { id: parsed.data.unitId, tenantId: tenant.id },
    select: { id: true, label: true, projectId: true, pricingPlanId: true },
  });
  if (!unit) return { ok: false, error: "Unit not found." };

  try {
    await prisma.clientUnitLink.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        unitId: unit.id,
        pricingPlanId: unit.pricingPlanId ?? null,
        role: parsed.data.role,
        notes: parsed.data.notes || null,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "CLIENTS",
      entityType: "CLIENT_UNIT_LINK",
      entityId: unit.id,
      action: "CREATE",
      summary: `Linked unit ${unit.label} to client ${client.fullName}.`,
    });
  } catch {
    return { ok: false, error: "This unit may already be linked to this client." };
  }

  revalidateClients(tenantSlug, clientId);
  return { ok: true };
}

export async function linkClientShortlet(
  tenantSlug: string,
  clientId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseLinkClientShortletForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  }

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const client = await prisma.propertyClient.findFirst({
    where: { id: clientId, tenantId: tenant.id },
    select: { id: true, fullName: true },
  });
  if (!client) return { ok: false, error: "Client not found." };

  const shortletUnit = await prisma.shortletUnit.findFirst({
    where: { id: parsed.data.shortletUnitId, tenantId: tenant.id, isActive: true },
    select: { id: true, name: true },
  });
  if (!shortletUnit) return { ok: false, error: "Apartment not found." };

  try {
    await prisma.clientShortletLink.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        shortletUnitId: shortletUnit.id,
        role: parsed.data.role,
        notes: parsed.data.notes || null,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "CLIENTS",
      entityType: "CLIENT_SHORTLET_LINK",
      entityId: shortletUnit.id,
      action: "CREATE",
      summary: `Linked short-let ${shortletUnit.name} to client ${client.fullName}.`,
    });
  } catch {
    return { ok: false, error: "This apartment may already be linked to this client." };
  }

  revalidateClients(tenantSlug, clientId);
  return { ok: true };
}

export async function unlinkClientShortlet(
  tenantSlug: string,
  clientId: string,
  linkId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const link = await prisma.clientShortletLink.findFirst({
    where: { id: linkId, tenantId: tenant.id, clientId },
    select: { id: true },
  });
  if (!link) return { ok: false, error: "Link not found." };

  await prisma.clientShortletLink.delete({ where: { id: link.id } });
  revalidateClients(tenantSlug, clientId);
  return { ok: true };
}

export async function unlinkClientUnit(
  tenantSlug: string,
  clientId: string,
  linkId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const link = await prisma.clientUnitLink.findFirst({
    where: { id: linkId, tenantId: tenant.id, clientId },
    select: { id: true },
  });
  if (!link) return { ok: false, error: "Link not found." };

  await prisma.clientUnitLink.delete({ where: { id: link.id } });
  revalidateClients(tenantSlug, clientId);
  return { ok: true };
}

export async function deletePropertyClient(
  tenantSlug: string,
  clientId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to delete clients." };
  }

  const existing = await prisma.propertyClient.findFirst({
    where: { id: clientId, tenantId: tenant.id },
    select: { id: true, fullName: true },
  });
  if (!existing) return { ok: false, error: "Client not found." };

  try {
    await prisma.propertyClient.delete({ where: { id: existing.id } });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "CLIENTS",
      entityType: "PROPERTY_CLIENT",
      entityId: existing.id,
      action: "DELETE",
      summary: `Deleted client ${existing.fullName}.`,
    });
  } catch {
    return { ok: false, error: "Could not delete this client right now." };
  }

  revalidateClients(tenantSlug);
  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true };
}

export async function recordClientDeposit(
  tenantSlug: string,
  clientId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseRecordClientDepositForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  }

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to record client payments." };
  }

  const tenantRecord = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: { defaultCurrency: true },
  });

  const client = await prisma.propertyClient.findFirst({
    where: { id: clientId, tenantId: tenant.id },
    select: { id: true, fullName: true },
  });
  if (!client) return { ok: false, error: "Client not found." };

  const unit = await prisma.unit.findFirst({
    where: { id: parsed.data.unitId, tenantId: tenant.id },
    select: {
      id: true,
      label: true,
      projectId: true,
      pricingPlanId: true,
      project: { select: { name: true } },
      deal: { select: { id: true, propertyClient: { select: { id: true } } } },
    },
  });
  if (!unit) return { ok: false, error: "Unit not found." };

  const kind = parsed.data.paymentKind || "part_payment";
  const adjustment =
    kind === "set_sale_price" || kind === "waive_remaining"
      ? kind
      : parsed.data.balanceAdjustment || "none";
  const paymentAmount = parsed.data.amount || 0;
  const openingPaid = kind === "catch_up" ? parsed.data.alreadyPaid || 0 : 0;

  try {
    await prisma.$transaction(async (tx) => {
      const existingLink = await tx.clientUnitLink.findFirst({
        where: { tenantId: tenant.id, clientId: client.id, unitId: unit.id },
        select: { id: true },
      });
      const link =
        existingLink ??
        (await tx.clientUnitLink.create({
          data: {
            tenantId: tenant.id,
            clientId: client.id,
            unitId: unit.id,
            pricingPlanId: unit.pricingPlanId,
          },
          select: { id: true },
        }));

      const paidWhere = {
        tenantId: tenant.id,
        voidedAt: null as Date | null,
        unitId: unit.id,
        OR: [
          { propertyClientId: client.id },
          { invoice: { deal: { propertyClient: { id: client.id } } } },
        ],
      };

      async function collectedOnFile() {
        const paidAgg = await tx.paymentRecord.aggregate({
          where: {
            ...paidWhere,
            incomeType: { not: "SHORTLET_REVENUE" },
          },
          _sum: { amount: true },
        });
        return Number(paidAgg._sum.amount || 0);
      }

      if (kind === "catch_up") {
        const alreadyOnFile = await collectedOnFile();
        const remainingToPay = parsed.data.remainingToPay ?? 0;
        const agreedPrice = agreedPriceFromCatchUp({
          alreadyOnFile,
          openingPaid,
          payingNow: paymentAmount,
          remainingToPay,
        });
        await tx.clientUnitLink.update({
          where: { id: link.id },
          data: {
            agreedPrice,
            priceAdjustmentReason:
              parsed.data.adjustmentReason || "Sale price from paid + remaining (catch-up)",
            priceAdjustedAt: new Date(),
            priceAdjustedByUserId: session.user.id,
          },
        });
        if (unit.deal?.id && (!unit.deal.propertyClient || unit.deal.propertyClient.id === client.id)) {
          await tx.deal.update({
            where: { id: unit.deal.id },
            data: { value: agreedPrice },
          });
        }
      } else if (adjustment !== "none") {
        let agreedPrice = parsed.data.agreedPrice || 0;
        const adjustmentReason =
          parsed.data.adjustmentReason ||
          (adjustment === "waive_remaining" ? "Balance waived" : "Discounted sale price");
        if (adjustment === "waive_remaining") {
          agreedPrice = (await collectedOnFile()) + paymentAmount;
        }
        await tx.clientUnitLink.update({
          where: { id: link.id },
          data: {
            agreedPrice,
            priceAdjustmentReason: adjustmentReason,
            priceAdjustedAt: new Date(),
            priceAdjustedByUserId: session.user.id,
          },
        });
        if (unit.deal?.id && (!unit.deal.propertyClient || unit.deal.propertyClient.id === client.id)) {
          await tx.deal.update({
            where: { id: unit.deal.id },
            data: { value: agreedPrice },
          });
        }
      }

      const tenantId = tenant.id;
      const clientRecordId = client.id;
      const clientName = client.fullName;
      const unitRecordId = unit.id;
      const unitProjectId = unit.projectId;
      const unitTitle = `${unit.project.name} ${unit.label}`;
      const paidAt = parsed.data.paidAt;
      const method = parsed.data.method || null;
      const reference = parsed.data.reference || null;
      const note = parsed.data.note || null;
      const recorderId = session.user.id;
      const recorderLabel = session.user.name || session.user.email || "Unknown recorder";
      const currency = tenantRecord?.defaultCurrency || "NGN";

      const writePayment = async (amount: number, titleSuffix: string, extraNote?: string) => {
        if (!(amount > 0)) return;
        await tx.paymentRecord.create({
          data: {
            tenantId,
            invoiceId: null,
            propertyClientId: clientRecordId,
            projectId: unitProjectId,
            unitId: unitRecordId,
            incomeType: "CLIENT_DEPOSIT",
            standaloneTitle: `Client deposit · ${clientName} · ${unitTitle}${titleSuffix}`,
            payerName: clientName,
            amount,
            currency,
            paidAt: new Date(paidAt),
            method,
            reference,
            note: extraNote || note,
            recordedByUserId: recorderId,
            recordedByLabel: recorderLabel,
          },
        });
      };

      if (openingPaid > 0) {
        await writePayment(
          openingPaid,
          " · previously paid",
          [parsed.data.note, "Previously paid (opening balance brought onto books)."]
            .filter(Boolean)
            .join(" "),
        );
      }
      await writePayment(paymentAmount, "");
    });

    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "FINANCE",
      entityType: "PAYMENT",
      entityId: client.id,
      action: paymentAmount > 0 ? "CREATE" : "UPDATE",
      summary:
        paymentAmount > 0
          ? `Recorded client deposit for ${client.fullName} on ${unit.project.name} ${unit.label}.`
          : `Updated sale price for ${client.fullName} on ${unit.project.name} ${unit.label}.`,
      metadata: {
        amount: paymentAmount,
        openingPaid,
        remainingToPay: kind === "catch_up" ? parsed.data.remainingToPay ?? null : null,
        unitId: unit.id,
        projectId: unit.projectId,
        incomeType: "CLIENT_DEPOSIT",
        paymentKind: kind,
        balanceAdjustment: adjustment,
        agreedPrice: parsed.data.agreedPrice ?? null,
        adjustmentReason: parsed.data.adjustmentReason ?? null,
      },
    });
  } catch {
    return { ok: false, error: "Could not record this payment right now." };
  }

  revalidateClients(tenantSlug, clientId);
  revalidatePath(`/${tenantSlug}/finance`);
  if (kind === "catch_up") {
    if (openingPaid > 0 || paymentAmount > 0) {
      return {
        ok: true,
        message:
          "Catch-up saved. Previously paid and this payment are collections; leftover is the remaining balance. Any brochure gap is discount, not income.",
      };
    }
    return {
      ok: true,
      message: "Sale price set from remaining balance. Brochure discount is not recorded as income.",
    };
  }
  if (paymentAmount > 0 && adjustment !== "none") {
    return { ok: true, message: "Payment saved. Remaining balance now uses the agreed sale price." };
  }
  if (paymentAmount > 0) return { ok: true, message: "Payment recorded." };
  return { ok: true, message: "Sale price updated. Remaining balance no longer uses the full unit price." };
}

export async function recordClientEarning(
  tenantSlug: string,
  clientId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseRecordClientEarningForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  }

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to record property earnings." };
  }

  const tenantRecord = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: { defaultCurrency: true },
  });

  const client = await prisma.propertyClient.findFirst({
    where: { id: clientId, tenantId: tenant.id },
    select: { id: true, fullName: true },
  });
  if (!client) return { ok: false, error: "Client not found." };

  const unit = await prisma.unit.findFirst({
    where: { id: parsed.data.unitId, tenantId: tenant.id },
    select: {
      id: true,
      label: true,
      projectId: true,
      project: { select: { name: true } },
    },
  });
  if (!unit) return { ok: false, error: "Unit not found." };

  try {
    await prisma.paymentRecord.create({
      data: {
        tenantId: tenant.id,
        invoiceId: null,
        propertyClientId: client.id,
        projectId: unit.projectId,
        unitId: unit.id,
        incomeType: "SHORTLET_REVENUE",
        standaloneTitle: `Property earning · ${client.fullName} · ${unit.project.name} ${unit.label}`,
        payerName: client.fullName,
        amount: parsed.data.amount,
        currency: tenantRecord?.defaultCurrency || "NGN",
        paidAt: new Date(parsed.data.paidAt),
        method: parsed.data.method || null,
        reference: parsed.data.reference || null,
        note: parsed.data.note || null,
        recordedByUserId: session.user.id,
        recordedByLabel: session.user.name || session.user.email || "Unknown recorder",
      },
    });

    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "FINANCE",
      entityType: "PAYMENT",
      entityId: client.id,
      action: "CREATE",
      summary: `Recorded property earning for ${client.fullName} on ${unit.project.name} ${unit.label}.`,
      metadata: {
        amount: parsed.data.amount,
        unitId: unit.id,
        projectId: unit.projectId,
        incomeType: "SHORTLET_REVENUE",
      },
    });
  } catch {
    return { ok: false, error: "Could not record this earning right now." };
  }

  revalidateClients(tenantSlug, clientId);
  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true, message: "Earning recorded. It does not reduce remaining on the sale." };
}

export async function voidClientPayment(
  tenantSlug: string,
  clientId: string,
  paymentId: string,
  input?: { reason?: string },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to remove client payments." };
  }

  const payment = await prisma.paymentRecord.findFirst({
    where: { id: paymentId, tenantId: tenant.id },
    include: {
      invoice: {
        select: {
          id: true,
          amount: true,
          balanceDue: true,
          status: true,
          invoiceNumber: true,
          deal: { select: { propertyClient: { select: { id: true } } } },
        },
      },
    },
  });
  if (!payment) return { ok: false, error: "Payment not found." };
  if (payment.voidedAt) return { ok: false, error: "This payment is already removed." };

  const belongsToClient =
    payment.propertyClientId === clientId ||
    payment.invoice?.deal?.propertyClient?.id === clientId;
  if (!belongsToClient) {
    const linked = payment.unitId
      ? await prisma.clientUnitLink.findFirst({
          where: { tenantId: tenant.id, clientId, unitId: payment.unitId },
          select: { id: true },
        })
      : null;
    if (!linked || payment.propertyClientId) {
      return { ok: false, error: "This payment does not belong to this client." };
    }
  }

  const matchedRow = await prisma.bankStatementRow.findFirst({
    where: {
      tenantId: tenant.id,
      matchedEntityType: "PAYMENT",
      matchedEntityId: payment.id,
      matchStatus: BankMatchStatus.MATCHED,
    },
    select: { id: true },
  });
  if (matchedRow) {
    return {
      ok: false,
      error: "This payment is reconciled to a bank statement. Undo that match in Finance before removing it.",
    };
  }

  const reason = (input?.reason || "").trim() || "Incorrect payment";
  const actorLabel = session.user.name || session.user.email || "Unknown user";
  try {
    await prisma.$transaction(async (tx) => {
      await tx.paymentRecord.update({
        where: { id: payment.id },
        data: {
          voidedAt: new Date(),
          voidedByUserId: session.user.id,
          voidedByLabel: actorLabel,
          voidReason: reason,
        },
      });

      if (payment.invoice && payment.invoice.status !== InvoiceStatus.VOID) {
        const nextBalance = Number(payment.invoice.balanceDue) + Number(payment.amount);
        const nextStatus =
          nextBalance <= 0
            ? InvoiceStatus.PAID
            : nextBalance >= Number(payment.invoice.amount)
              ? InvoiceStatus.SENT
              : InvoiceStatus.PARTIALLY_PAID;
        await tx.invoice.update({
          where: { id: payment.invoice.id },
          data: { balanceDue: nextBalance, status: nextStatus },
        });
      }
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel,
      module: "FINANCE",
      entityType: "PAYMENT",
      entityId: payment.id,
      action: "VOID",
      summary: `Removed client payment for ${Number(payment.amount).toLocaleString()}. Reason: ${reason}`,
      metadata: {
        reason,
        amount: Number(payment.amount),
        clientId,
        unitId: payment.unitId,
        projectId: payment.projectId,
      },
    });
  } catch {
    return { ok: false, error: "Could not remove this payment right now." };
  }

  revalidateClients(tenantSlug, clientId);
  revalidatePath(`/${tenantSlug}/finance`);
  return { ok: true, message: "Payment removed. Totals no longer include it; the audit log keeps the record." };
}

export async function sendClientPortalInvite(
  tenantSlug: string,
  clientId: string,
): Promise<
  | { ok: true; emailSent: boolean; alreadyOnPortal?: boolean; emailError?: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const [tenantRecord, client] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenant.id }, select: { id: true, name: true } }),
    prisma.propertyClient.findFirst({
      where: { id: clientId, tenantId: tenant.id },
      select: { id: true, fullName: true, email: true },
    }),
  ]);

  if (!tenantRecord) return { ok: false, error: "Organization not found." };
  if (!client) return { ok: false, error: "Client not found." };
  if (!client.email?.trim())
    return { ok: false, error: "Add an email address before sending a portal invite." };

  const inviteResult = await sendPropertyClientPortalInvite({
    tenantId: tenantRecord.id,
    tenantName: tenantRecord.name,
    email: client.email,
    inviterLabel: session.user.name || session.user.email || "Organization admin",
    clientId: client.id,
  });

  if (!inviteResult.ok) return inviteResult;

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "CLIENTS",
    entityType: "INVITATION",
    entityId: client.id,
    action: inviteResult.emailSent ? "EMAIL_SENT" : inviteResult.alreadyActive ? "SKIPPED" : "EMAIL_FAILED",
    summary: inviteResult.alreadyActive
      ? `${client.fullName} already has portal access.`
      : inviteResult.emailSent
        ? `Portal invite sent to ${client.email}.`
        : `Portal invite email failed for ${client.email}: ${inviteResult.emailError}`,
    metadata: { email: client.email, clientId: client.id },
  });

  revalidateClients(tenantSlug, clientId);
  return inviteResult;
}

export async function getClientUploadSignature(
  tenantSlug: string,
  input?: { fileName?: string },
): Promise<CloudinaryUploadSignature | CloudinaryUploadError> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to upload client files." };
  }
  return createTenantUploadSignature({
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    area: "clients",
    fileName: input?.fileName,
  });
}

export async function addClientDocument(
  tenantSlug: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsed = addClientDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const client = await prisma.propertyClient.findFirst({
    where: { id: parsed.data.clientId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!client) return { ok: false, error: "Client not found." };

  await prisma.clientDocument.create({
    data: {
      tenantId: tenant.id,
      clientId: client.id,
      category: parsed.data.category as ClientDocumentCategory,
      title: parsed.data.title,
      fileUrl: parsed.data.fileUrl,
      fileName: parsed.data.fileName || null,
      visibleInPortal: parsed.data.visibleInPortal ?? false,
      uploadedByUserId: session.user.id,
      uploadedByLabel: session.user.name || session.user.email || "Team",
    },
  });
  revalidateClients(tenantSlug, client.id);
  return { ok: true };
}

export async function setClientDocumentPortalVisibility(
  tenantSlug: string,
  documentId: string,
  visibleInPortal: boolean,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const doc = await prisma.clientDocument.findFirst({
    where: { id: documentId, tenantId: tenant.id },
    select: { id: true, clientId: true },
  });
  if (!doc) return { ok: false, error: "Document not found." };

  await prisma.clientDocument.update({
    where: { id: doc.id },
    data: { visibleInPortal },
  });
  revalidateClients(tenantSlug, doc.clientId);
  revalidatePath(`/${tenantSlug}/portal/documents`);
  return { ok: true };
}

export async function createClientFromDeal(
  tenantSlug: string,
  dealId: string,
): Promise<ActionResult & { clientId?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId: tenant.id },
    select: { id: true, propertyClient: { select: { id: true } } },
  });
  if (!deal) return { ok: false, error: "Deal not found." };
  if (deal.propertyClient) return { ok: true, clientId: deal.propertyClient.id };

  try {
    const result = await ensureClientFromDeal(tenant.id, dealId);
    if (!result) return { ok: false, error: "Deal not found." };
    revalidateClients(tenantSlug, result.clientId);
    return { ok: true, clientId: result.clientId };
  } catch {
    return { ok: false, error: "Could not create client from deal." };
  }
}

// ---------------------------------------------------------------------------
// CSV bulk import
// ---------------------------------------------------------------------------

export type ImportClientRow = {
  fullName: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  country?: string;
  status?: string;
  notes?: string;
  projectName?: string;
  unitLabel?: string;
  pricingPlanName?: string;
  unitRole?: string;
};

function parseImportClientStatus(raw?: string): PropertyClientStatus {
  const v = (raw ?? "").trim().toUpperCase();
  if (v === "ACTIVE") return PropertyClientStatus.ACTIVE;
  if (v === "FORMER") return PropertyClientStatus.FORMER;
  return PropertyClientStatus.PROSPECT;
}

function parseImportUnitRole(raw?: string) {
  const v = (raw ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  if (v === "CO_OWNER" || v === "CO-OWNER") return "CO_OWNER" as const;
  if (v === "TENANT") return "TENANT" as const;
  if (v === "INVESTOR") return "INVESTOR" as const;
  if (v === "BENEFICIARY") return "BENEFICIARY" as const;
  return "OWNER" as const;
}

export async function importClients(
  tenantSlug: string,
  rows: ImportClientRow[],
): Promise<
  { ok: true; count: number; unitsLinked: number; unitLinkSkipped: number } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  if (!rows.length) return { ok: false, error: "No rows to import." };
  if (rows.length > 1000) return { ok: false, error: "Maximum 1 000 rows per import." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to import clients." };
  }

  const projects = await prisma.project.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true,
      name: true,
      units: { select: { id: true, label: true, pricingPlanId: true } },
      pricingPlans: { select: { id: true, name: true } },
    },
  });

  const validRows = rows.filter((r) => r.fullName?.trim());
  if (!validRows.length) return { ok: false, error: "No valid rows found (full name is required)." };

  let count = 0;
  let unitsLinked = 0;
  let unitLinkSkipped = 0;

  for (const row of validRows) {
    const client = await prisma.propertyClient.create({
      data: {
        tenantId: tenant.id,
        fullName: row.fullName.trim(),
        email: row.email?.trim() || null,
        phone: row.phone?.trim() || null,
        alternatePhone: row.alternatePhone?.trim() || null,
        addressLine: row.addressLine?.trim() || null,
        city: row.city?.trim() || null,
        state: row.state?.trim() || null,
        country: row.country?.trim() || "Nigeria",
        status: parseImportClientStatus(row.status),
        notes: row.notes?.trim() || null,
      },
    });
    count += 1;

    const projectName = row.projectName?.trim();
    const unitLabel = row.unitLabel?.trim();
    if (!projectName || !unitLabel) continue;

    const project = projects.find((p) => p.name.toLowerCase() === projectName.toLowerCase());
    const unit = project?.units.find((u) => u.label.toLowerCase() === unitLabel.toLowerCase());
    if (!project || !unit) {
      unitLinkSkipped += 1;
      continue;
    }

    let pricingPlanId = unit.pricingPlanId;
    const planName = row.pricingPlanName?.trim();
    if (planName) {
      const plan = project.pricingPlans.find((p) => p.name.toLowerCase() === planName.toLowerCase());
      if (plan) pricingPlanId = plan.id;
    }

    try {
      await prisma.clientUnitLink.create({
        data: {
          tenantId: tenant.id,
          clientId: client.id,
          unitId: unit.id,
          pricingPlanId,
          role: parseImportUnitRole(row.unitRole),
        },
      });
      unitsLinked += 1;
    } catch {
      unitLinkSkipped += 1;
    }
  }

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "CLIENTS",
    entityType: "PROPERTY_CLIENT",
    entityId: tenant.id,
    action: "IMPORT",
    summary: `Bulk imported ${count} client(s) via CSV (${unitsLinked} unit link(s)).`,
  });

  revalidateClients(tenantSlug);
  return { ok: true, count, unitsLinked, unitLinkSkipped };
}

// ---------------------------------------------------------------------------
// Import clients from unit labels
// ---------------------------------------------------------------------------

export type UnitLabelImportPreviewGroup = {
  key: string;
  fullName: string;
  warning: string | null;
  defaultSelected: boolean;
  existingClientId: string | null;
  existingClientName: string | null;
  suggestedStatus: "ACTIVE" | "PROSPECT";
  suggestedRole: "OWNER" | "TENANT";
  units: Array<{
    id: string;
    label: string;
    projectName: string;
    status: string;
    purpose: string;
  }>;
};

export type UnitLabelImportPreview =
  | {
      ok: true;
      preset: UnitNamePatternPresetId;
      pattern: string;
      unitsScanned: number;
      skippedNoName: number;
      skippedAlreadyLinked: number;
      groups: UnitLabelImportPreviewGroup[];
    }
  | { ok: false; error: string };

async function loadUnitsForLabelImport(tenantId: string, projectId?: string) {
  const units = await prisma.unit.findMany({
    where: { tenantId, ...(projectId ? { projectId } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 2000,
    select: {
      id: true,
      label: true,
      purpose: true,
      status: true,
      pricingPlanId: true,
      project: { select: { id: true, name: true } },
      clientLinks: { select: { id: true }, take: 1 },
    },
  });
  return units.map((unit) => ({
    id: unit.id,
    label: unit.label,
    projectId: unit.project.id,
    projectName: unit.project.name,
    purpose: unit.purpose,
    status: unit.status,
    pricingPlanId: unit.pricingPlanId,
    alreadyLinked: unit.clientLinks.length > 0,
  }));
}

export async function previewClientsFromUnitLabels(
  tenantSlug: string,
  input?: { preset?: UnitNamePatternPresetId; pattern?: string; projectId?: string },
): Promise<UnitLabelImportPreview> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to import clients." };
  }

  const tenantRecord = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: { name: true },
  });
  const units = await loadUnitsForLabelImport(tenant.id, input?.projectId);
  if (!units.length) {
    return { ok: false, error: "No project units found. Add units to a project first." };
  }

  const labels = units.filter((unit) => !unit.alreadyLinked).map((unit) => unit.label);
  const detected = detectUnitNamePattern(labels);
  const preset = input?.preset ?? detected.preset;
  const pattern =
    preset === "custom"
      ? (input?.pattern || "").trim()
      : input?.pattern || detected.pattern;

  if (preset === "custom" && !/{name}/i.test(pattern)) {
    return { ok: false, error: "Custom pattern must include {name} so we know which part is the client." };
  }

  const grouped = groupUnitsByExtractedClient(units, { preset, pattern });
  const existing = await prisma.propertyClient.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, fullName: true },
  });
  const existingByKey = new Map(
    existing.map((client) => [normalizeClientNameKey(client.fullName), client] as const),
  );

  const groups: UnitLabelImportPreviewGroup[] = grouped.groups.map((group) => {
    const orgMatch = tenantRecord?.name
      ? nameLooksGeneric(group.fullName, tenantRecord.name)
      : false;
    const existingClient = existingByKey.get(group.key) ?? null;
    const warning = orgMatch
      ? `This matches the organization name (${tenantRecord?.name}).`
      : group.warning;
    return {
      key: group.key,
      fullName: existingClient?.fullName || group.fullName,
      warning,
      defaultSelected: existingClient ? true : orgMatch ? false : group.defaultSelected,
      existingClientId: existingClient?.id ?? null,
      existingClientName: existingClient?.fullName ?? null,
      suggestedStatus: suggestedClientStatus(
        group.units.map((unit) => unit.status),
        group.units.map((unit) => unit.purpose),
      ),
      suggestedRole: suggestedClientRole(group.units.map((unit) => unit.purpose)),
      units: group.units.map((unit) => ({
        id: unit.id,
        label: unit.label,
        projectName: unit.projectName,
        status: unit.status,
        purpose: unit.purpose,
      })),
    };
  });

  return {
    ok: true,
    preset,
    pattern,
    unitsScanned: units.length,
    skippedNoName: grouped.skippedNoName,
    skippedAlreadyLinked: grouped.skippedAlreadyLinked,
    groups,
  };
}

export async function importClientsFromUnitLabels(
  tenantSlug: string,
  input: {
    preset: UnitNamePatternPresetId;
    pattern?: string;
    selectedKeys: string[];
    projectId?: string;
  },
): Promise<
  | { ok: true; created: number; reused: number; unitsLinked: number; skipped: number }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  if (!input.selectedKeys.length) return { ok: false, error: "Select at least one client to import." };
  if (input.selectedKeys.length > 500) return { ok: false, error: "Select 500 clients or fewer per import." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to import clients." };
  }

  const preview = await previewClientsFromUnitLabels(tenantSlug, {
    preset: input.preset,
    pattern: input.pattern,
    projectId: input.projectId,
  });
  if (!preview.ok) return preview;

  const selected = new Set(input.selectedKeys.map((key) => key.toUpperCase()));
  const groups = preview.groups.filter((group) => selected.has(group.key));
  if (!groups.length) return { ok: false, error: "None of the selected clients matched the current pattern." };

  const unitIds = groups.flatMap((group) => group.units.map((unit) => unit.id));
  const units = await prisma.unit.findMany({
    where: { tenantId: tenant.id, id: { in: unitIds } },
    select: { id: true, label: true, pricingPlanId: true },
  });
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const alreadyLinked = new Set(
    (
      await prisma.clientUnitLink.findMany({
        where: { tenantId: tenant.id, unitId: { in: unitIds } },
        select: { unitId: true },
      })
    ).map((link) => link.unitId),
  );

  let created = 0;
  let reused = 0;
  let unitsLinked = 0;
  let skipped = 0;

  for (const group of groups) {
    let clientId = group.existingClientId;
    if (!clientId) {
      const client = await prisma.propertyClient.create({
        data: {
          tenantId: tenant.id,
          fullName: group.fullName,
          status:
            group.suggestedStatus === "ACTIVE"
              ? PropertyClientStatus.ACTIVE
              : PropertyClientStatus.PROSPECT,
          notes: `Imported from unit names (${group.units.map((unit) => unit.label).join(", ")}).`,
        },
      });
      clientId = client.id;
      created += 1;
    } else {
      reused += 1;
      if (group.suggestedStatus === "ACTIVE") {
        await prisma.propertyClient.updateMany({
          where: {
            id: clientId,
            tenantId: tenant.id,
            status: PropertyClientStatus.PROSPECT,
          },
          data: { status: PropertyClientStatus.ACTIVE },
        });
      }
    }

    for (const unitRef of group.units) {
      const unit = unitById.get(unitRef.id);
      if (!unit || alreadyLinked.has(unit.id)) {
        skipped += 1;
        continue;
      }
      try {
        await prisma.clientUnitLink.create({
          data: {
            tenantId: tenant.id,
            clientId,
            unitId: unit.id,
            pricingPlanId: unit.pricingPlanId ?? null,
            role: ClientUnitLinkRole.OWNER,
            notes: reservedOwnerNote(unitRef.status),
          },
        });
        alreadyLinked.add(unit.id);
        unitsLinked += 1;
      } catch {
        skipped += 1;
      }
    }
  }

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "CLIENTS",
    entityType: "PROPERTY_CLIENT",
    entityId: tenant.id,
    action: "IMPORT",
    summary: `Imported ${created} client(s) from unit names (${reused} already existed, ${unitsLinked} unit link(s)).`,
  });

  revalidateClients(tenantSlug);
  return { ok: true, created, reused, unitsLinked, skipped };
}
