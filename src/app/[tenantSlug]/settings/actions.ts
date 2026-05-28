"use server";

import { auth } from "@/auth";
import { MembershipRole, MembershipStatus, Prisma } from "@/generated/prisma";
import { createTenantUploadSignature, type CloudinaryUploadSignature } from "@/lib/cloudinary-upload-server";
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

function parseLinesList(value: FormDataEntryValue | null): string[] {
  const raw = String(value || "");
  return Array.from(
    new Set(
      raw
        .split(/\r?\n|,/g)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  );
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

export async function saveOrganizationBranding(tenantSlug: string, _prev: unknown, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, settings: { select: { id: true } } },
  });
  if (!tenant) return { ok: false, error: "Organization not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true },
  });
  if (!session.user.isPlatformAdmin && !canRenameOrg(false, membership?.role)) {
    return { ok: false, error: "Only admins can update branding." };
  }

  const primaryColor = (formData.get("primaryColor") as string)?.trim() || null;
  const accentColor = (formData.get("accentColor") as string)?.trim() || null;

  const data = {
    primaryColor,
    accentColor,
    orgEmail: (formData.get("orgEmail") as string)?.trim() || null,
    orgPhone: (formData.get("orgPhone") as string)?.trim() || null,
    orgAddressLine: (formData.get("orgAddressLine") as string)?.trim() || null,
    orgCity: (formData.get("orgCity") as string)?.trim() || null,
    orgState: (formData.get("orgState") as string)?.trim() || null,
    orgCountry: (formData.get("orgCountry") as string)?.trim() || "Nigeria",
    logoUrl: (formData.get("logoUrl") as string)?.trim() || null,
  };

  if (tenant.settings) {
    await prisma.tenantSettings.update({ where: { tenantId: tenant.id }, data });
  } else {
    await prisma.tenantSettings.create({ data: { tenantId: tenant.id, ...data } });
  }

  revalidatePath(`/${tenantSlug}/settings`);
  revalidatePath(`/${tenantSlug}/hr`);
  revalidatePath(`/${tenantSlug}`, "layout");
  return { ok: true };
}

export async function saveOrganizationLogoUrl(
  tenantSlug: string,
  logoUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = z.string().trim().url("Invalid logo URL.").safeParse(logoUrl);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid logo URL." };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, settings: { select: { id: true } } },
  });
  if (!tenant) return { ok: false, error: "Organization not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });
  if (!session.user.isPlatformAdmin && !canRenameOrg(false, membership?.role)) {
    return { ok: false, error: "Only admins can update branding." };
  }
  if (!session.user.isPlatformAdmin && membership?.status !== MembershipStatus.ACTIVE) {
    return { ok: false, error: "No access." };
  }

  if (tenant.settings) {
    await prisma.tenantSettings.update({
      where: { tenantId: tenant.id },
      data: { logoUrl: parsed.data },
    });
  } else {
    await prisma.tenantSettings.create({
      data: { tenantId: tenant.id, logoUrl: parsed.data },
    });
  }

  revalidatePath(`/${tenantSlug}/settings`);
  revalidatePath(`/${tenantSlug}/hr`);
  revalidatePath(`/${tenantSlug}`, "layout");
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
  const moduleHr = formData.get("moduleHr") === "on";
  const moduleTasks = formData.get("moduleTasks") === "on";
  const DEFAULT_DEPARTMENTS = ["Finance", "Sales", "Marketing", "Community"];
  const parsedDepartments = parseLinesList(formData.get("orgDepartmentsCsv"));
  const orgDepartments = Array.from(
    new Set([...DEFAULT_DEPARTMENTS, ...parsedDepartments].map((x) => x.trim()).filter(Boolean)),
  ).slice(0, 50);

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
        moduleHr,
        moduleTasks,
        orgDepartments: orgDepartments as Prisma.InputJsonValue,
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
        moduleHr,
        moduleTasks,
        orgDepartments: orgDepartments as Prisma.InputJsonValue,
        roleModuleGrants: roleModuleGrantsParsed ? (roleModuleGrantsParsed as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }

  revalidatePath(`/${tenantSlug}`);
  revalidatePath(`/${tenantSlug}/settings`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Integrations settings (Meta Lead Ads + Termii)
// ---------------------------------------------------------------------------
export async function saveIntegrationSettings(tenantSlug: string, _prev: unknown, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, settings: { select: { id: true } } },
  });
  if (!tenant) return { ok: false, error: "Organization not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true },
  });
  if (!session.user.isPlatformAdmin && !canManageOrgModules(false, membership?.role)) {
    return { ok: false, error: "Only admins can change integration settings." };
  }

  const data = {
    logoUrl: (formData.get("logoUrl") as string)?.trim() || null,
    metaVerifyToken: (formData.get("metaVerifyToken") as string)?.trim() || null,
    metaPageAccessToken: (formData.get("metaPageAccessToken") as string)?.trim() || null,
    metaDefaultSource: (formData.get("metaDefaultSource") as string)?.trim() || "Facebook",
    termiiApiKey: (formData.get("termiiApiKey") as string)?.trim() || null,
    termiiSenderId: (formData.get("termiiSenderId") as string)?.trim() || "Realcorp",
    whatsappAccessToken: (formData.get("whatsappAccessToken") as string)?.trim() || null,
    whatsappPhoneNumberId: (formData.get("whatsappPhoneNumberId") as string)?.trim() || null,
    whatsappVerifyToken: (formData.get("whatsappVerifyToken") as string)?.trim() || null,
    // File uploads use platform CLOUDINARY_* in server .env — not configured per tenant here.
    // Finance dropdown catalogs are edited only on Finance → Settings; do not wipe them here.
  };

  if (tenant.settings) {
    await prisma.tenantSettings.update({ where: { tenantId: tenant.id }, data });
  } else {
    await prisma.tenantSettings.create({ data: { tenantId: tenant.id, ...data } });
  }

  revalidatePath(`/${tenantSlug}/settings`);
  revalidatePath(`/${tenantSlug}`, "layout");
  return { ok: true };
}

export async function getOrgLogoUploadSignature(
  tenantSlug: string,
  input?: { fileName?: string },
): Promise<CloudinaryUploadSignature | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true },
  });
  if (!tenant) return { ok: false, error: "Organization not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });
  if (!canManageOrgModules(Boolean(session.user.isPlatformAdmin), membership?.role)) {
    return { ok: false, error: "Only admins can upload branding assets." };
  }
  if (!session.user.isPlatformAdmin && membership?.status !== MembershipStatus.ACTIVE) {
    return { ok: false, error: "No access." };
  }

  return createTenantUploadSignature({
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    area: "branding",
    fileName: input?.fileName || "company-logo",
  });
}
