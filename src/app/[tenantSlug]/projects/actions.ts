"use server";

import { auth } from "@/auth";
import { DealStage, MembershipRole, MembershipStatus, UnitPurpose, UnitStatus } from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";
import {
  parseCreatePricingPlanForm,
  parseCreateProjectForm,
  parseCreateUnitForm,
} from "@/lib/validators/project";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };

async function getTenantAndAccess(tenantSlug: string, userId: string, isPlatformAdmin?: boolean) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) return { tenant: null, canManage: false };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId } },
    select: { role: true, status: true },
  });

  const canManage =
    Boolean(isPlatformAdmin) ||
    (membership?.status === MembershipStatus.ACTIVE &&
      (membership.role === MembershipRole.ORG_ADMIN || membership.role === MembershipRole.SALES_MANAGER));

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
  } catch {
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
    select: { id: true },
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
      },
    });
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

    await prisma.project.update({
      where: { id: project.id },
      data: {
        name: parsed.data.name,
        basePrice: parsed.data.basePrice ? Number(parsed.data.basePrice) : null,
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
      action: "UPDATE",
      summary: `Updated project ${parsed.data.name}.`,
    });
  } catch {
    return { ok: false, error: "Could not update project right now." };
  }

  revalidatePath(`/${tenantSlug}/projects`);
  revalidatePath(`/${tenantSlug}/projects/${projectId}`);
  return { ok: true };
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
  } catch {
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
  const canUnreserve = Boolean(session.user.isPlatformAdmin) || membership?.status === MembershipStatus.ACTIVE;
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
