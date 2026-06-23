"use server";

import { auth } from "@/auth";
import {
  ClientDocumentCategory,
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
  parseUpdatePropertyClientForm,
} from "@/lib/validators/clients";
import { ensureClientFromDeal } from "@/lib/ensure-client-from-deal";
import { sendPropertyClientPortalInvite } from "@/lib/client-portal-invite";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };

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
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Client not found." };

  try {
    await prisma.propertyClient.update({
      where: { id: existing.id },
      data: {
        fullName: parsed.data.fullName,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        alternatePhone: parsed.data.alternatePhone || null,
        addressLine: parsed.data.addressLine || null,
        city: parsed.data.city || null,
        state: parsed.data.state || null,
        country: parsed.data.country || "Nigeria",
        status: parsed.data.status ?? PropertyClientStatus.ACTIVE,
        notes: parsed.data.notes || null,
      },
    });
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
  if (!client.email?.trim()) return { ok: false, error: "Add an email address before sending a portal invite." };

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
      uploadedByUserId: session.user.id,
      uploadedByLabel: session.user.name || session.user.email || "Team",
    },
  });
  revalidateClients(tenantSlug, client.id);
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
  | { ok: true; count: number; unitsLinked: number; unitLinkSkipped: number }
  | { ok: false; error: string }
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
