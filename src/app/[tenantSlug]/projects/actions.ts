"use server";

import { auth } from "@/auth";
import { DealStage, InventoryLocationKind, MembershipRole, MembershipStatus, UnitPurpose, UnitStatus } from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";
import {
  parseAmenitiesFromForm,
  parseCreatePricingPlanForm,
  parseCreateProjectForm,
  parseCreateUnitForm,
  parseCreateUnitsBulkForm,
  parseUpdatePricingPlanForm,
} from "@/lib/validators/project";
import { revalidatePath } from "next/cache";
import { createTenantUploadSignature, type CloudinaryUploadSignature } from "@/lib/cloudinary-upload-server";
import { parseMembershipModulePermissions } from "@/lib/membership-module-permissions";
import {
  ensureClientsFromUnitLabels,
  wantsImportAsClient,
} from "@/lib/ensure-client-from-unit-label";
import { compareByUnitLabel } from "@/lib/unit-label-sort";

type ActionResult = { ok: true } | { ok: false; error: string };

function logProjectActionError(action: string, tenantSlug: string, error: unknown) {
  console.error(`[projects:${action}] tenant=${tenantSlug}`, error);
}

async function getTenantAndAccess(tenantSlug: string, userId: string, isPlatformAdmin?: boolean) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) return { tenant: null, canManage: false };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId } },
    select: { role: true, status: true, modulePermissions: true },
  });

  const projectAccess = parseMembershipModulePermissions(membership?.modulePermissions).projects;
  const canManage =
    Boolean(isPlatformAdmin) ||
    (membership?.status === MembershipStatus.ACTIVE &&
      (membership.role === MembershipRole.ORG_ADMIN ||
        membership.role === MembershipRole.SALES_MANAGER ||
        projectAccess === "full"));

  return { tenant, canManage };
}

export async function createProject(
  tenantSlug: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseCreateProjectForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }

  const { tenant, canManage } = await getTenantAndAccess(
    tenantSlug,
    session.user.id,
    session.user.isPlatformAdmin,
  );
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManage) return { ok: false, error: "Only org admins and sales managers can create projects." };

  try {
    const project = await prisma.project.create({
      data: {
        tenantId: tenant.id,
        name: parsed.data.name,
        basePrice: parsed.data.basePrice ? Number(parsed.data.basePrice) : null,
        serviceCharge: parsed.data.serviceCharge ? Number(parsed.data.serviceCharge) : null,
        currency: (parsed.data.currency || "NGN").toUpperCase(),
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "PROJECTS",
      entityType: "PROJECT",
      entityId: project.id,
      action: "CREATE",
      summary: `Created project ${project.name}.`,
    });
    await prisma.inventoryLocation.create({
      data: {
        tenantId: tenant.id,
        name: `${project.name} store`,
        kind: InventoryLocationKind.PROJECT,
        projectId: project.id,
      },
    }).catch(() => undefined);
  } catch (error) {
    logProjectActionError("createProject", tenantSlug, error);
    return { ok: false, error: "Could not create project right now." };
  }

  revalidatePath(`/${tenantSlug}/projects`);
  return { ok: true };
}

export async function createUnit(
  tenantSlug: string,
  projectId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseCreateUnitForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }

  const { tenant, canManage } = await getTenantAndAccess(
    tenantSlug,
    session.user.id,
    session.user.isPlatformAdmin,
  );
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManage) return { ok: false, error: "Only org admins and sales managers can create units." };

  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    select: { id: true, name: true },
  });
  if (!project) return { ok: false, error: "Project not found." };

  try {
    const pricingPlan = parsed.data.pricingPlanId
      ? await prisma.projectPricingPlan.findFirst({
          where: { id: parsed.data.pricingPlanId, tenantId: tenant.id, projectId: project.id },
          select: { id: true },
        })
      : null;
    if (parsed.data.pricingPlanId && !pricingPlan) {
      return { ok: false, error: "Selected pricing plan is invalid for this project." };
    }

    const unit = await prisma.unit.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        pricingPlanId: parsed.data.pricingPlanId || null,
        label: parsed.data.label,
        purpose: parsed.data.purpose ?? UnitPurpose.SALE,
        unitType: parsed.data.unitType || null,
        status: (parsed.data.status as UnitStatus) || UnitStatus.AVAILABLE,
        serviceFee: parsed.data.serviceFee != null ? Number(parsed.data.serviceFee) : null,
      },
    });
    if (wantsImportAsClient(formData)) {
      await ensureClientsFromUnitLabels({
        tenantId: tenant.id,
        projectName: project.name,
        units: [
          {
            id: unit.id,
            label: unit.label,
            purpose: unit.purpose,
            status: unit.status,
            pricingPlanId: unit.pricingPlanId,
          },
        ],
      });
      revalidatePath(`/${tenantSlug}/clients`);
    }
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "PROJECTS",
      entityType: "UNIT",
      entityId: unit.id,
      action: "CREATE",
      summary: `Created unit ${unit.label}.`,
    });
  } catch {
    return { ok: false, error: "Could not create unit right now." };
  }

  revalidatePath(`/${tenantSlug}/projects/${projectId}`);
  return { ok: true };
}

export async function createUnitsBulk(
  tenantSlug: string,
  projectId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult & { count?: number }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseCreateUnitsBulkForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }

  const { tenant, canManage } = await getTenantAndAccess(
    tenantSlug,
    session.user.id,
    session.user.isPlatformAdmin,
  );
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManage) return { ok: false, error: "Only org admins and sales managers can create units." };

  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    select: { id: true, name: true, units: { select: { label: true } } },
  });
  if (!project) return { ok: false, error: "Project not found." };

  const existing = new Set(project.units.map((u) => u.label.toLowerCase()));
  const uniqueLabels = [...new Set(parsed.data.labels.map((l) => l.trim()))].sort(compareByUnitLabel);
  const duplicate = uniqueLabels.find((l) => existing.has(l.toLowerCase()));
  if (duplicate) {
    return { ok: false, error: `Unit "${duplicate}" already exists in this project.` };
  }

  try {
    const pricingPlan = parsed.data.pricingPlanId
      ? await prisma.projectPricingPlan.findFirst({
          where: { id: parsed.data.pricingPlanId, tenantId: tenant.id, projectId: project.id },
          select: { id: true },
        })
      : null;
    if (parsed.data.pricingPlanId && !pricingPlan) {
      return { ok: false, error: "Selected pricing plan is invalid for this project." };
    }

    const createdUnits = await prisma.$transaction(
      uniqueLabels.map((label) =>
        prisma.unit.create({
          data: {
            tenantId: tenant.id,
            projectId: project.id,
            pricingPlanId: parsed.data.pricingPlanId || null,
            label,
            purpose: parsed.data.purpose ?? UnitPurpose.SALE,
            unitType: parsed.data.unitType || null,
            status: (parsed.data.status as UnitStatus) || UnitStatus.AVAILABLE,
            serviceFee: parsed.data.serviceFee != null ? Number(parsed.data.serviceFee) : null,
          },
          select: {
            id: true,
            label: true,
            purpose: true,
            status: true,
            pricingPlanId: true,
          },
        }),
      ),
    );
    if (wantsImportAsClient(formData)) {
      await ensureClientsFromUnitLabels({
        tenantId: tenant.id,
        projectName: project.name,
        units: createdUnits,
      });
      revalidatePath(`/${tenantSlug}/clients`);
    }

    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "PROJECTS",
      entityType: "UNIT",
      entityId: project.id,
      action: "CREATE",
      summary: `Created ${uniqueLabels.length} units (${uniqueLabels.slice(0, 3).join(", ")}${uniqueLabels.length > 3 ? "…" : ""}).`,
      metadata: { labels: uniqueLabels, count: uniqueLabels.length },
    });
  } catch (error) {
    logProjectActionError("createUnitsBulk", tenantSlug, error);
    return { ok: false, error: "Could not create units right now." };
  }

  revalidatePath(`/${tenantSlug}/projects/${projectId}`);
  return { ok: true, count: uniqueLabels.length };
}

export async function updateProject(
  tenantSlug: string,
  projectId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseCreateProjectForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }

  const { tenant, canManage } = await getTenantAndAccess(
    tenantSlug,
    session.user.id,
    session.user.isPlatformAdmin,
  );
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManage) return { ok: false, error: "Only org admins and sales managers can edit projects." };

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!project) return { ok: false, error: "Project not found." };

    const galleryUrls = ((formData.get("galleryUrls") as string) ?? "")
      .split(/\n+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u))
      .slice(0, 12);
    const coverImageUrl = ((formData.get("coverImageUrl") as string) ?? "").trim().slice(0, 600) || null;

    await prisma.project.update({
      where: { id: project.id },
      data: {
        name: parsed.data.name,
        basePrice: parsed.data.basePrice ? Number(parsed.data.basePrice) : null,
        serviceCharge: parsed.data.serviceCharge ? Number(parsed.data.serviceCharge) : null,
        currency: (parsed.data.currency || "NGN").toUpperCase(),
        coverImageUrl,
        galleryUrls,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "PROJECTS",
      entityType: "PROJECT",
      entityId: project.id,
      action: "UPDATE",
      summary: `Updated project ${parsed.data.name}.`,
    });
  } catch (error) {
    logProjectActionError("updateProject", tenantSlug, error);
    return { ok: false, error: "Could not update project right now." };
  }

  revalidatePath(`/${tenantSlug}/projects`);
  revalidatePath(`/${tenantSlug}/projects/${projectId}`);
  return { ok: true };
}

/** Save the public listing details for a project (Explore page / API / widget). */
export async function updateProjectListing(
  tenantSlug: string,
  projectId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, canManage } = await getTenantAndAccess(
    tenantSlug,
    session.user.id,
    session.user.isPlatformAdmin,
  );
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManage) return { ok: false, error: "Only org admins and sales managers can edit listings." };

  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    select: { id: true, name: true, isPublished: true },
  });
  if (!project) return { ok: false, error: "Project not found." };

  const text = (field: string, max = 300) => (formData.get(field) as string)?.trim().slice(0, max) || null;

  const isPublished = formData.get("isPublished") === "on";
  const galleryUrls = ((formData.get("galleryUrls") as string) ?? "")
    .split(/\n+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u))
    .slice(0, 12);
  const amenities = parseAmenitiesFromForm(formData);

  try {
    await prisma.project.update({
      where: { id: project.id },
      data: {
        isPublished,
        publishedAt: isPublished && !project.isPublished ? new Date() : undefined,
        listingDescription: text("listingDescription", 2000),
        locationCity: text("locationCity", 120),
        locationState: text("locationState", 120),
        locationCountry: text("locationCountry", 120),
        locationAddress: text("locationAddress", 300),
        coverImageUrl: text("coverImageUrl", 600),
        galleryUrls,
        amenities,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "PROJECTS",
      entityType: "PROJECT",
      entityId: project.id,
      action: isPublished ? "LISTING_PUBLISHED" : "LISTING_UPDATED",
      summary: `${isPublished ? "Published" : "Updated"} public listing for ${project.name}.`,
    });
  } catch (error) {
    logProjectActionError("updateProjectListing", tenantSlug, error);
    return { ok: false, error: "Could not save the listing right now." };
  }

  revalidatePath(`/${tenantSlug}/projects`);
  revalidatePath(`/${tenantSlug}/listings`);
  revalidatePath(`/explore/${tenantSlug}`);
  return { ok: true };
}

/** Link an investor / listing-owner member to a project with an allocation amount. */
export async function addProjectStakeholder(
  tenantSlug: string,
  projectId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, canManage } = await getTenantAndAccess(
    tenantSlug,
    session.user.id,
    session.user.isPlatformAdmin,
  );
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManage) return { ok: false, error: "Only org admins and sales managers can manage stakeholders." };

  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    select: { id: true, name: true },
  });
  if (!project) return { ok: false, error: "Project not found." };

  const userId = ((formData.get("userId") as string) ?? "").trim();
  if (!userId) return { ok: false, error: "Pick a member to add." };

  // The member must hold one of the portal roles; their role decides the stake type.
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId } },
    select: { role: true, status: true, user: { select: { name: true, email: true } } },
  });
  if (
    !membership ||
    membership.status !== MembershipStatus.ACTIVE ||
    (membership.role !== MembershipRole.INVESTOR && membership.role !== MembershipRole.LISTING_OWNER)
  ) {
    return { ok: false, error: "Pick an active member with the Investor or Listing owner role." };
  }

  const allocationRaw = Number(((formData.get("investmentAmount") as string) ?? "").replace(/[,\s]/g, ""));
  if (!Number.isFinite(allocationRaw) || allocationRaw <= 0) {
    return { ok: false, error: "Enter an allocation amount for this stakeholder." };
  }
  const investmentAmount = allocationRaw;

  const existingStakes = await prisma.projectStakeholder.findMany({
    where: { projectId: project.id },
    select: { userId: true, investmentAmount: true },
  });
  let totalAllocation = investmentAmount;
  for (const row of existingStakes) {
    if (row.userId === userId) continue;
    const amount = row.investmentAmount != null ? Number(row.investmentAmount) : 0;
    if (amount > 0) totalAllocation += amount;
  }
  const sharePercent =
    totalAllocation > 0 ? Math.round((investmentAmount / totalAllocation) * 10000) / 100 : 100;

  const notes = ((formData.get("notes") as string) ?? "").trim().slice(0, 500) || null;

  try {
    await prisma.projectStakeholder.upsert({
      where: { projectId_userId: { projectId: project.id, userId } },
      create: {
        tenantId: tenant.id,
        projectId: project.id,
        userId,
        type: membership.role === MembershipRole.INVESTOR ? "INVESTOR" : "LISTING_OWNER",
        sharePercent,
        investmentAmount,
        notes,
      },
      update: { sharePercent, investmentAmount, notes },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "PROJECTS",
      entityType: "PROJECT_STAKEHOLDER",
      entityId: project.id,
      action: "STAKEHOLDER_ADDED",
      summary: `Linked ${membership.user.name || membership.user.email || "a member"} to ${project.name} (allocation ${investmentAmount.toLocaleString()}).`,
      metadata: { projectId: project.id, userId, investmentAmount },
    });
  } catch (error) {
    logProjectActionError("addProjectStakeholder", tenantSlug, error);
    return { ok: false, error: "Could not save the stakeholder right now." };
  }

  revalidatePath(`/${tenantSlug}/projects`);
  revalidatePath(`/${tenantSlug}/stakeholders`);
  revalidatePath(`/${tenantSlug}/portal`);
  return { ok: true };
}

export async function removeProjectStakeholder(
  tenantSlug: string,
  stakeholderId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, canManage } = await getTenantAndAccess(
    tenantSlug,
    session.user.id,
    session.user.isPlatformAdmin,
  );
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManage) return { ok: false, error: "Only org admins and sales managers can manage stakeholders." };

  const stake = await prisma.projectStakeholder.findFirst({
    where: { id: stakeholderId, tenantId: tenant.id },
    select: { id: true, project: { select: { name: true } }, user: { select: { name: true, email: true } } },
  });
  if (!stake) return { ok: false, error: "Stakeholder not found." };

  try {
    await prisma.projectStakeholder.delete({ where: { id: stake.id } });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "PROJECTS",
      entityType: "PROJECT_STAKEHOLDER",
      entityId: stake.id,
      action: "STAKEHOLDER_REMOVED",
      summary: `Removed ${stake.user.name || stake.user.email || "a member"} from ${stake.project.name}.`,
    });
  } catch (error) {
    logProjectActionError("removeProjectStakeholder", tenantSlug, error);
    return { ok: false, error: "Could not remove the stakeholder right now." };
  }

  revalidatePath(`/${tenantSlug}/projects`);
  revalidatePath(`/${tenantSlug}/stakeholders`);
  revalidatePath(`/${tenantSlug}/portal`);
  return { ok: true };
}

export async function getListingImageUploadSignature(
  tenantSlug: string,
  input?: { fileName?: string; projectId?: string },
): Promise<CloudinaryUploadSignature | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, canManage } = await getTenantAndAccess(
    tenantSlug,
    session.user.id,
    session.user.isPlatformAdmin,
  );
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManage)
    return { ok: false, error: "Only org admins and sales managers can upload listing images." };

  const tenantRow = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: { slug: true, settings: { select: { moduleListings: true } } },
  });
  if (tenantRow?.settings?.moduleListings === false) {
    return { ok: false, error: "Public listings are not enabled on your plan." };
  }

  const prefix = input?.projectId ? `listing-${input.projectId}` : "listing";
  return createTenantUploadSignature({
    tenantId: tenant.id,
    tenantSlug: tenantRow!.slug,
    area: "listings",
    fileName: input?.fileName || "photo",
    publicIdPrefix: prefix,
  });
}

export async function deleteProject(
  tenantSlug: string,
  projectId: string,
  _prev: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, canManage } = await getTenantAndAccess(
    tenantSlug,
    session.user.id,
    session.user.isPlatformAdmin,
  );
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManage) return { ok: false, error: "Only org admins and sales managers can delete projects." };

  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    select: { id: true, _count: { select: { units: true } } },
  });
  if (!project) return { ok: false, error: "Project not found." };
  if (project._count.units > 0) {
    return { ok: false, error: "Cannot delete project with units. Remove or move units first." };
  }

  try {
    await prisma.project.delete({ where: { id: project.id } });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "PROJECTS",
      entityType: "PROJECT",
      entityId: project.id,
      action: "DELETE",
      summary: "Deleted project.",
    });
  } catch (error) {
    logProjectActionError("deleteProject", tenantSlug, error);
    return { ok: false, error: "Could not delete project right now." };
  }

  revalidatePath(`/${tenantSlug}/projects`);
  return { ok: true };
}

export async function updateUnit(
  tenantSlug: string,
  projectId: string,
  unitId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseCreateUnitForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }

  const { tenant, canManage } = await getTenantAndAccess(
    tenantSlug,
    session.user.id,
    session.user.isPlatformAdmin,
  );
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManage) return { ok: false, error: "Only org admins and sales managers can edit units." };

  const unit = await prisma.unit.findFirst({
    where: { id: unitId, tenantId: tenant.id, projectId },
    select: { id: true },
  });
  if (!unit) return { ok: false, error: "Unit not found." };

  try {
    const pricingPlan = parsed.data.pricingPlanId
      ? await prisma.projectPricingPlan.findFirst({
          where: { id: parsed.data.pricingPlanId, tenantId: tenant.id, projectId },
          select: { id: true },
        })
      : null;
    if (parsed.data.pricingPlanId && !pricingPlan) {
      return { ok: false, error: "Selected pricing plan is invalid for this project." };
    }

    await prisma.unit.update({
      where: { id: unit.id },
      data: {
        pricingPlanId: parsed.data.pricingPlanId || null,
        label: parsed.data.label,
        purpose: parsed.data.purpose ?? UnitPurpose.SALE,
        unitType: parsed.data.unitType || null,
        status: (parsed.data.status as UnitStatus) || UnitStatus.AVAILABLE,
        serviceFee: parsed.data.serviceFee != null ? Number(parsed.data.serviceFee) : null,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "PROJECTS",
      entityType: "UNIT",
      entityId: unit.id,
      action: "UPDATE",
      summary: `Updated unit ${parsed.data.label}.`,
    });
  } catch {
    return { ok: false, error: "Could not update unit right now." };
  }

  revalidatePath(`/${tenantSlug}/projects/${projectId}`);
  return { ok: true };
}

export async function deleteUnit(
  tenantSlug: string,
  projectId: string,
  unitId: string,
  _prev: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, canManage } = await getTenantAndAccess(
    tenantSlug,
    session.user.id,
    session.user.isPlatformAdmin,
  );
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManage) return { ok: false, error: "Only org admins and sales managers can delete units." };

  const unit = await prisma.unit.findFirst({
    where: { id: unitId, tenantId: tenant.id, projectId },
    select: { id: true, status: true, deal: { select: { id: true } } },
  });
  if (!unit) return { ok: false, error: "Unit not found." };
  if (unit.deal?.id) return { ok: false, error: "Cannot delete unit linked to a deal." };
  if (unit.status === UnitStatus.RESERVED || unit.status === UnitStatus.SOLD) {
    return { ok: false, error: "Cannot delete reserved or sold unit." };
  }

  try {
    await prisma.unit.delete({ where: { id: unit.id } });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "PROJECTS",
      entityType: "UNIT",
      entityId: unit.id,
      action: "DELETE",
      summary: "Deleted unit.",
    });
  } catch {
    return { ok: false, error: "Could not delete unit right now." };
  }

  revalidatePath(`/${tenantSlug}/projects/${projectId}`);
  return { ok: true };
}

export async function reserveUnit(
  tenantSlug: string,
  projectId: string,
  unitId: string,
  _prev: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true },
  });
  const canReserve = Boolean(session.user.isPlatformAdmin) || membership?.status === MembershipStatus.ACTIVE;
  if (!canReserve) return { ok: false, error: "You do not have permission to reserve units." };

  const unit = await prisma.unit.findFirst({
    where: { id: unitId, tenantId: tenant.id, projectId },
    select: { id: true },
  });
  if (!unit) return { ok: false, error: "Unit not found." };

  try {
    await prisma.$transaction(async (tx) => {
      const lock = await tx.unit.updateMany({
        where: { id: unit.id, tenantId: tenant.id, projectId, status: UnitStatus.AVAILABLE },
        data: { status: UnitStatus.RESERVED },
      });

      if (lock.count !== 1) {
        throw new Error("conflict");
      }

      await tx.deal.create({
        data: {
          tenantId: tenant.id,
          unitId: unit.id,
          assignedUserId: session.user.id,
          stage: DealStage.RESERVATION_MADE,
        },
      });
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "PROJECTS",
      entityType: "UNIT",
      entityId: unit.id,
      action: "RESERVE",
      summary: "Reserved unit and created reservation deal.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "conflict") {
      return { ok: false, error: "This unit is no longer available. Another user may have reserved it." };
    }
    return { ok: false, error: "Could not reserve unit right now." };
  }

  revalidatePath(`/${tenantSlug}/projects/${projectId}`);
  return { ok: true };
}

export async function unreserveUnit(
  tenantSlug: string,
  projectId: string,
  unitId: string,
  _prev: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true },
  });
  const canUnreserve =
    Boolean(session.user.isPlatformAdmin) || membership?.status === MembershipStatus.ACTIVE;
  if (!canUnreserve) return { ok: false, error: "You do not have permission to unreserve units." };

  try {
    await prisma.$transaction(async (tx) => {
      const lock = await tx.unit.updateMany({
        where: { id: unitId, tenantId: tenant.id, projectId, status: UnitStatus.RESERVED },
        data: { status: UnitStatus.AVAILABLE },
      });
      if (lock.count !== 1) throw new Error("conflict");

      const linkedDeal = await tx.deal.findFirst({
        where: { tenantId: tenant.id, unitId, stage: DealStage.RESERVATION_MADE },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (linkedDeal) {
        await tx.deal.update({
          where: { id: linkedDeal.id },
          data: { stage: DealStage.CLOSED_LOST, unitId: null },
        });
      }
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "PROJECTS",
      entityType: "UNIT",
      entityId: unitId,
      action: "UNRESERVE",
      summary: "Unreserved unit.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "conflict") {
      return { ok: false, error: "This unit is not currently reserved." };
    }
    return { ok: false, error: "Could not unreserve unit right now." };
  }

  revalidatePath(`/${tenantSlug}/projects/${projectId}`);
  return { ok: true };
}

export async function createPricingPlan(
  tenantSlug: string,
  projectId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseCreatePricingPlanForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }

  const { tenant, canManage } = await getTenantAndAccess(
    tenantSlug,
    session.user.id,
    session.user.isPlatformAdmin,
  );
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManage) return { ok: false, error: "Only org admins and sales managers can create pricing plans." };

  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!project) return { ok: false, error: "Project not found." };

  try {
    const plan = await prisma.projectPricingPlan.create({
      data: {
        tenantId: tenant.id,
        projectId: project.id,
        name: parsed.data.name,
        price: Number(parsed.data.price),
        currency: parsed.data.currency.toUpperCase(),
        initialDeposit: parsed.data.initialDeposit ? Number(parsed.data.initialDeposit) : null,
        paymentDurationMonths: parsed.data.paymentDurationMonths
          ? Number(parsed.data.paymentDurationMonths)
          : null,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "PROJECTS",
      entityType: "PRICING_PLAN",
      entityId: plan.id,
      action: "CREATE",
      summary: `Created pricing plan ${plan.name}.`,
    });
  } catch {
    return { ok: false, error: "Could not create pricing plan right now." };
  }

  revalidatePath(`/${tenantSlug}/projects/${projectId}`);
  return { ok: true };
}

export async function updatePricingPlan(
  tenantSlug: string,
  projectId: string,
  planId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseUpdatePricingPlanForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }

  const { tenant, canManage } = await getTenantAndAccess(
    tenantSlug,
    session.user.id,
    session.user.isPlatformAdmin,
  );
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManage) return { ok: false, error: "Only org admins and sales managers can edit pricing plans." };

  const existing = await prisma.projectPricingPlan.findFirst({
    where: { id: planId, tenantId: tenant.id, projectId },
    select: { id: true, name: true },
  });
  if (!existing) return { ok: false, error: "Pricing plan not found." };

  try {
    await prisma.projectPricingPlan.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name,
        price: Number(parsed.data.price),
        currency: parsed.data.currency.toUpperCase(),
        initialDeposit: parsed.data.initialDeposit ? Number(parsed.data.initialDeposit) : null,
        paymentDurationMonths: parsed.data.paymentDurationMonths
          ? Number(parsed.data.paymentDurationMonths)
          : null,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "PROJECTS",
      entityType: "PRICING_PLAN",
      entityId: existing.id,
      action: "UPDATE",
      summary: `Updated pricing plan ${parsed.data.name}.`,
    });
  } catch {
    return { ok: false, error: "Could not update pricing plan right now." };
  }

  revalidatePath(`/${tenantSlug}/projects/${projectId}`);
  return { ok: true };
}

export async function deletePricingPlan(
  tenantSlug: string,
  projectId: string,
  planId: string,
  _prev: ActionResult | null,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, canManage } = await getTenantAndAccess(
    tenantSlug,
    session.user.id,
    session.user.isPlatformAdmin,
  );
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!canManage) return { ok: false, error: "Only org admins and sales managers can delete pricing plans." };

  const existing = await prisma.projectPricingPlan.findFirst({
    where: { id: planId, tenantId: tenant.id, projectId },
    select: { id: true, name: true, _count: { select: { units: true } } },
  });
  if (!existing) return { ok: false, error: "Pricing plan not found." };

  try {
    await prisma.projectPricingPlan.delete({ where: { id: existing.id } });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "PROJECTS",
      entityType: "PRICING_PLAN",
      entityId: existing.id,
      action: "DELETE",
      summary: `Deleted pricing plan ${existing.name}${
        existing._count.units > 0 ? ` (${existing._count.units} unit(s) unlinked)` : ""
      }.`,
    });
  } catch {
    return { ok: false, error: "Could not delete pricing plan right now." };
  }

  revalidatePath(`/${tenantSlug}/projects/${projectId}`);
  return { ok: true };
}
