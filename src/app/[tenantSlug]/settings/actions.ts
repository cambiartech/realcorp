"use server";

import { auth } from "@/auth";
import { MembershipRole, MembershipStatus, Prisma } from "@/generated/prisma";
import { createTenantUploadSignature, type CloudinaryUploadSignature } from "@/lib/cloudinary-upload-server";
import prisma from "@/lib/db";
import { parseRoleModuleGrantsFromFormData } from "@/lib/role-module-grants-form";
import { parseMembershipModulePermissions } from "@/lib/membership-module-permissions";
import { mergeOrgDepartments, normalizeOrgDepartmentName } from "@/lib/org-departments";
import { canAccessNavKey, normalizeSettingsNavSlice } from "@/lib/tenant-nav-access";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";

function canManageOrgModules(isPlatformAdmin: boolean, role: MembershipRole | undefined) {
  return isPlatformAdmin || role === MembershipRole.ORG_ADMIN;
}

function canAddOrgDepartment(isPlatformAdmin: boolean, role: MembershipRole | undefined) {
  return (
    isPlatformAdmin ||
    role === MembershipRole.ORG_ADMIN ||
    role === MembershipRole.FINANCE_MANAGER
  );
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
    select: { id: true, settings: { select: { id: true, payrollSettings: true } } },
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
  const payrollCountryCode = String(formData.get("payrollCountryCode") || "NG")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(payrollCountryCode)) {
    return { ok: false, error: "Payroll country must be a two-letter ISO code, such as NG, GH, GB, or US." };
  }
  const contributionRate = (key: string, fallback: number) => {
    const raw = String(formData.get(key) ?? fallback).trim();
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
  };
  const nsitfRate = contributionRate("nsitfRate", 1);
  const itfRate = contributionRate("itfRate", 0);
  if (nsitfRate === null || itfRate === null) {
    return { ok: false, error: "Employer contribution rates must be between 0 and 100 percent." };
  }
  const currentPayrollSettings =
    tenant.settings?.payrollSettings &&
    typeof tenant.settings.payrollSettings === "object" &&
    !Array.isArray(tenant.settings.payrollSettings)
      ? (tenant.settings.payrollSettings as Record<string, unknown>)
      : {};

  const data = {
    primaryColor,
    accentColor,
    orgEmail: (formData.get("orgEmail") as string)?.trim() || null,
    orgPhone: (formData.get("orgPhone") as string)?.trim() || null,
    orgAddressLine: (formData.get("orgAddressLine") as string)?.trim() || null,
    orgCity: (formData.get("orgCity") as string)?.trim() || null,
    orgState: (formData.get("orgState") as string)?.trim() || null,
    orgCountry: (formData.get("orgCountry") as string)?.trim() || "Nigeria",
    payrollCountryCode,
    payrollSettings: {
      ...currentPayrollSettings,
      employerContributions: [
        { code: "NSITF", label: "Employee Compensation contribution", rate: nsitfRate },
        { code: "ITF", label: "Industrial Training Fund", rate: itfRate },
      ],
    },
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

export async function saveOrgDepartments(tenantSlug: string, _prev: unknown, formData: FormData) {
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
    return { ok: false, error: "Only an organization admin can manage departments." };
  }
  if (!session.user.isPlatformAdmin && membership?.status !== MembershipStatus.ACTIVE) {
    return { ok: false, error: "No access." };
  }

  const parsedCustom = parseLinesList(formData.get("orgDepartmentsCsv"));
  const orgDepartments = mergeOrgDepartments(parsedCustom).slice(0, 50);

  if (!tenant.settings) {
    await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        orgDepartments: orgDepartments as Prisma.InputJsonValue,
      },
    });
  } else {
    await prisma.tenantSettings.update({
      where: { tenantId: tenant.id },
      data: { orgDepartments: orgDepartments as Prisma.InputJsonValue },
    });
  }

  revalidatePath(`/${tenantSlug}`);
  revalidatePath(`/${tenantSlug}/settings`);
  revalidatePath(`/${tenantSlug}/finance`);
  revalidatePath(`/${tenantSlug}/hr`);
  return { ok: true };
}

export async function addOrgDepartment(
  tenantSlug: string,
  rawName: string,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const next = normalizeOrgDepartmentName(rawName);
  if (!next) return { ok: false, error: "Enter a department name." };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      settings: {
        select: {
          id: true,
          orgDepartments: true,
          moduleSales: true,
          moduleFinance: true,
          moduleMarketing: true,
          moduleCommunity: true,
          moduleShortLets: true,
          moduleHr: true,
          moduleTasks: true,
          moduleClients: true,
          moduleListings: true,
          moduleInvestorPortal: true,
          roleModuleGrants: true,
        },
      },
    },
  });
  if (!tenant) return { ok: false, error: "Organization not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true, modulePermissions: true },
  });
  const canAdd =
    canAddOrgDepartment(Boolean(session.user.isPlatformAdmin), membership?.role) ||
    canAccessNavKey("finance", {
      role: membership?.role,
      isPlatformAdmin: Boolean(session.user.isPlatformAdmin),
      settings: normalizeSettingsNavSlice(tenant.settings),
      userModulePermissions: parseMembershipModulePermissions(membership?.modulePermissions),
    });
  if (!canAdd) {
    return { ok: false, error: "You do not have permission to add a department." };
  }
  if (!session.user.isPlatformAdmin && membership?.status !== MembershipStatus.ACTIVE) {
    return { ok: false, error: "No access." };
  }

  const existing = mergeOrgDepartments(tenant.settings?.orgDepartments as string[] | null | undefined);
  const already = existing.find((d) => d.toLowerCase() === next.toLowerCase());
  if (already) return { ok: true, name: already };

  const orgDepartments = mergeOrgDepartments([...existing, next]).slice(0, 50);
  if (!tenant.settings) {
    await prisma.tenantSettings.create({
      data: { tenantId: tenant.id, orgDepartments: orgDepartments as Prisma.InputJsonValue },
    });
  } else {
    await prisma.tenantSettings.update({
      where: { tenantId: tenant.id },
      data: { orgDepartments: orgDepartments as Prisma.InputJsonValue },
    });
  }

  revalidatePath(`/${tenantSlug}`);
  revalidatePath(`/${tenantSlug}/settings`);
  revalidatePath(`/${tenantSlug}/finance`);
  revalidatePath(`/${tenantSlug}/hr`);
  return { ok: true, name: next };
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

  const roleModuleGrantsParsed = parseRoleModuleGrantsFromFormData(formData);

  if (!tenant.settings) {
    await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        ...(roleModuleGrantsParsed
          ? { roleModuleGrants: roleModuleGrantsParsed as Prisma.InputJsonValue }
          : {}),
      },
    });
  } else {
    await prisma.tenantSettings.update({
      where: { tenantId: tenant.id },
      data: {
        roleModuleGrants: roleModuleGrantsParsed
          ? (roleModuleGrantsParsed as Prisma.InputJsonValue)
          : Prisma.JsonNull,
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

  const existingSecrets = tenant.settings
    ? await prisma.tenantSettings.findUnique({
        where: { tenantId: tenant.id },
        select: { metaPageAccessToken: true, termiiApiKey: true, whatsappAccessToken: true },
      })
    : null;

  // Secrets: a blank input means "keep the saved value" so re-saving the form
  // never silently wipes a working integration. Other fields save as typed.
  const keepIfBlank = (field: string, existing: string | null | undefined) =>
    (formData.get(field) as string)?.trim() || existing || null;

  const data = {
    logoUrl: (formData.get("logoUrl") as string)?.trim() || null,
    metaVerifyToken: (formData.get("metaVerifyToken") as string)?.trim() || null,
    metaPageAccessToken: keepIfBlank("metaPageAccessToken", existingSecrets?.metaPageAccessToken),
    metaDefaultSource: (formData.get("metaDefaultSource") as string)?.trim() || "Facebook",
    termiiApiKey: keepIfBlank("termiiApiKey", existingSecrets?.termiiApiKey),
    termiiSenderId: (formData.get("termiiSenderId") as string)?.trim() || "Realcorp",
    whatsappAccessToken: keepIfBlank("whatsappAccessToken", existingSecrets?.whatsappAccessToken),
    whatsappPhoneNumberId: (formData.get("whatsappPhoneNumberId") as string)?.trim() || null,
    whatsappVerifyToken: (formData.get("whatsappVerifyToken") as string)?.trim() || null,
    whatsappBotEnabled: formData.get("whatsappBotEnabled") === "on",
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

/** Send a WhatsApp test message using the saved credentials so admins can verify the integration. */
export async function sendWhatsAppTestMessage(
  tenantSlug: string,
  testPhone: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      name: true,
      settings: { select: { whatsappAccessToken: true, whatsappPhoneNumberId: true, moduleWhatsApp: true } },
    },
  });
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (tenant.settings?.moduleWhatsApp === false) {
    return { ok: false, error: "WhatsApp is not enabled on your plan. Contact your platform admin." };
  }

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true },
  });
  if (!session.user.isPlatformAdmin && !canManageOrgModules(false, membership?.role)) {
    return { ok: false, error: "Only admins can test integrations." };
  }

  if (!tenant.settings?.whatsappAccessToken || !tenant.settings.whatsappPhoneNumberId) {
    return { ok: false, error: "Save your WhatsApp Access Token and Phone Number ID first." };
  }

  const { sendWhatsAppText, toWhatsAppPhone } = await import("@/lib/whatsapp");
  const to = toWhatsAppPhone(testPhone);
  if (!to) return { ok: false, error: "Enter a valid phone number (e.g. 0803 123 4567)." };

  const sent = await sendWhatsAppText({
    accessToken: tenant.settings.whatsappAccessToken,
    phoneNumberId: tenant.settings.whatsappPhoneNumberId,
    to,
    body: `${tenant.name} — WhatsApp integration test from Realcorp. If you received this, your setup works.`,
  });
  if (!sent.ok) return { ok: false, error: sent.error };
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
