"use server";

import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type ActionResult = { ok: true } | { ok: false; error: string };

async function getTenantAccess(tenantSlug: string, userId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) return { tenant: null, membership: null };
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId } },
    select: { status: true, role: true },
  });
  return { tenant, membership };
}

const saveDashboardSchema = z.object({
  roleView: z.string().trim().min(1).max(40).optional(),
  widgetIds: z.array(z.string().trim().min(1).max(80)).max(40),
});

export async function saveDashboardPreference(
  tenantSlug: string,
  input: { roleView?: string; widgetIds: string[] },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsed = saveDashboardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid dashboard configuration." };

  const { tenant, membership } = await getTenantAccess(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  const allowed = Boolean(session.user.isPlatformAdmin) || membership?.status === MembershipStatus.ACTIVE;
  if (!allowed) return { ok: false, error: "You do not have permission to save dashboard settings." };

  try {
    await prisma.dashboardPreference.upsert({
      where: {
        tenantId_userId: { tenantId: tenant.id, userId: session.user.id },
      },
      create: {
        tenantId: tenant.id,
        userId: session.user.id,
        roleView: parsed.data.roleView || null,
        widgetConfig: parsed.data.widgetIds,
      },
      update: {
        roleView: parsed.data.roleView || null,
        widgetConfig: parsed.data.widgetIds,
      },
    });
  } catch {
    return { ok: false, error: "Could not save dashboard settings right now." };
  }

  revalidatePath(`/${tenantSlug}`);
  return { ok: true };
}

const upsertGoalSchema = z.object({
  label: z.string().trim().min(2).max(80),
  fiscalYearStart: z.string().trim().min(1),
  fiscalYearEnd: z.string().trim().min(1),
  revenueTarget: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined))
    .refine((v) => !v || !Number.isNaN(Number(v)), "Revenue target must be a valid number."),
  pipelineTarget: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined))
    .refine((v) => !v || !Number.isNaN(Number(v)), "Pipeline target must be a valid number."),
});

export async function upsertTenantGoal(
  tenantSlug: string,
  input: {
    label: string;
    fiscalYearStart: string;
    fiscalYearEnd: string;
    revenueTarget?: string;
    pipelineTarget?: string;
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsed = upsertGoalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { tenant, membership } = await getTenantAccess(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  const canManageGoals =
    Boolean(session.user.isPlatformAdmin) ||
    (membership?.status === MembershipStatus.ACTIVE &&
      (membership.role === MembershipRole.ORG_ADMIN || membership.role === MembershipRole.FINANCE_MANAGER));
  if (!canManageGoals) return { ok: false, error: "Only org admin or finance manager can set fiscal goals." };

  const start = new Date(parsed.data.fiscalYearStart);
  const end = new Date(parsed.data.fiscalYearEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { ok: false, error: "Fiscal year dates are invalid." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.tenantGoal.updateMany({
        where: { tenantId: tenant.id, isActive: true },
        data: { isActive: false },
      });
      await tx.tenantGoal.create({
        data: {
          tenantId: tenant.id,
          label: parsed.data.label,
          fiscalYearStart: start,
          fiscalYearEnd: end,
          revenueTarget: parsed.data.revenueTarget ? Number(parsed.data.revenueTarget) : null,
          pipelineTarget: parsed.data.pipelineTarget ? Number(parsed.data.pipelineTarget) : null,
          isActive: true,
        },
      });
    });
  } catch {
    return { ok: false, error: "Could not save fiscal goal right now." };
  }

  revalidatePath(`/${tenantSlug}`);
  return { ok: true };
}
