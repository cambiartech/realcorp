"use server";

import { auth } from "@/auth";
import { MembershipRole, MembershipStatus, Prisma } from "@/generated/prisma";
import prisma from "@/lib/db";
import { parseRoleModuleGrantsFromFormData } from "@/lib/role-module-grants-form";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";

function canManageOrgModules(isPlatformAdmin: boolean, role: MembershipRole | undefined) {
  return isPlatformAdmin || role === MembershipRole.ORG_ADMIN;
}

function canRenameOrg(isPlatformAdmin: boolean, role: MembershipRole | undefined) {
  return isPlatformAdmin || role === MembershipRole.ORG_ADMIN;
}

export async function updateMyDisplayName(tenantSlug: string, _prev: unknown, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = z.string().trim().min(2).max(80).safeParse(formData.get("displayName"));
  if (!parsed.success) return { ok: false, error: "Display name must be 2–80 characters." };

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!tenant) return { ok: false, error: "Organization not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true },
  });
  if (!session.user.isPlatformAdmin && membership?.status !== MembershipStatus.ACTIVE) {
    return { ok: false, error: "No access." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data },
  });
  revalidatePath(`/${tenantSlug}/settings`);
  revalidatePath(`/${tenantSlug}`);
  return { ok: true };
}

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(8, "New password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Please confirm your new password."),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New password and confirmation do not match.",
    path: ["confirmPassword"],
  });

export async function updateMyPassword(tenantSlug: string, _prev: unknown, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!tenant) return { ok: false, error: "Organization not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true },
  });
  if (!session.user.isPlatformAdmin && membership?.status !== MembershipStatus.ACTIVE) {
    return { ok: false, error: "No access." };
  }

  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg =
      first.currentPassword?.[0] ||
      first.newPassword?.[0] ||
      first.confirmPassword?.[0] ||
      parsed.error.flatten().formErrors[0] ||
      "Invalid input.";
    return { ok: false, error: msg };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    return { ok: false, error: "This account does not use a password sign-in." };
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "Current password is incorrect." };

  const nextHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: nextHash },
  });

  revalidatePath(`/${tenantSlug}/settings`);
  return { ok: true };
}

export async function updateOrganizationName(tenantSlug: string, _prev: unknown, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = z.string().trim().min(2).max(120).safeParse(formData.get("organizationName"));
  if (!parsed.success) return { ok: false, error: "Organization name must be 2–120 characters." };

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!tenant) return { ok: false, error: "Organization not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });
  if (!canRenameOrg(Boolean(session.user.isPlatformAdmin), membership?.role)) {
    return { ok: false, error: "Only an organization admin can change the organization name." };
  }
  if (!session.user.isPlatformAdmin && membership?.status !== MembershipStatus.ACTIVE) {
    return { ok: false, error: "No access." };
  }

  await prisma.tenant.update({ where: { id: tenant.id }, data: { name: parsed.data } });
  revalidatePath(`/${tenantSlug}`);
  revalidatePath(`/${tenantSlug}/settings`);
  return { ok: true };
}

export async function updateOrgModules(tenantSlug: string, _prev: unknown, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, settings: { select: { id: true } } },
  });
  if (!tenant) return { ok: false, error: "Organization not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });
  if (!canManageOrgModules(Boolean(session.user.isPlatformAdmin), membership?.role)) {
    return { ok: false, error: "Only an organization admin can change modules." };
  }
  if (!session.user.isPlatformAdmin && membership?.status !== MembershipStatus.ACTIVE) {
    return { ok: false, error: "No access." };
  }

  const moduleSales = formData.get("moduleSales") === "on";
  const moduleFinance = formData.get("moduleFinance") === "on";
  const moduleMarketing = formData.get("moduleMarketing") === "on";
  const moduleCommunity = formData.get("moduleCommunity") === "on";
  const moduleRealtorPortal = formData.get("moduleRealtorPortal") === "on";

  const roleModuleGrantsParsed = parseRoleModuleGrantsFromFormData(formData);

  if (!tenant.settings) {
    await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        moduleSales,
        moduleFinance,
        moduleMarketing,
        moduleCommunity,
        moduleRealtorPortal,
        ...(roleModuleGrantsParsed ? { roleModuleGrants: roleModuleGrantsParsed as Prisma.InputJsonValue } : {}),
      },
    });
  } else {
    await prisma.tenantSettings.update({
      where: { tenantId: tenant.id },
      data: {
        moduleSales,
        moduleFinance,
        moduleMarketing,
        moduleCommunity,
        moduleRealtorPortal,
        roleModuleGrants: roleModuleGrantsParsed ? (roleModuleGrantsParsed as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }

  revalidatePath(`/${tenantSlug}`);
  revalidatePath(`/${tenantSlug}/settings`);
  return { ok: true };
}
