"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { MembershipRole, TenantPlan, TenantStatus } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { sendInviteEmail } from "@/lib/email";
import { buildInviteUrl, inviteExpiresAt, newInviteToken } from "@/lib/invitation-utils";
import { parseOrganizationOnboardingForm } from "@/lib/validators/organization";

export type OnboardResult =
  | { ok: true; tenantSlug: string; inviteUrl: string; emailSent: boolean; emailError?: string }
  | { ok: false; error: string };

export async function createOrganization(
  _prev: OnboardResult | null,
  formData: FormData,
): Promise<OnboardResult> {
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) {
    return { ok: false, error: "Only platform administrators can onboard organizations." };
  }

  const parsed = parseOrganizationOnboardingForm(formData);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((e) => e.message).join(" "),
    };
  }

  const planMap: Record<string, TenantPlan> = {
    STARTER: TenantPlan.STARTER,
    GROWTH: TenantPlan.GROWTH,
    ENTERPRISE: TenantPlan.ENTERPRISE,
    ANCHOR: TenantPlan.ANCHOR,
  };
  const plan = parsed.data.plan ? planMap[parsed.data.plan] : TenantPlan.GROWTH;

  const existing = await prisma.tenant.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return { ok: false, error: "That organization URL slug is already taken." };
  }

  const token = newInviteToken();
  const expiresAt = inviteExpiresAt();

  try {
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: parsed.data.organizationName,
          slug: parsed.data.slug,
          status: TenantStatus.ACTIVE,
          plan,
        },
      });

      await tx.tenantSettings.create({
        data: {
          tenantId: tenant.id,
          monthlyRevenueTarget: null,
          pipelineTarget: null,
        },
      });

      await tx.invitation.create({
        data: {
          tenantId: tenant.id,
          email: parsed.data.adminEmail,
          role: MembershipRole.ORG_ADMIN,
          token,
          expiresAt,
        },
      });
    });
  } catch {
    return { ok: false, error: "Could not create organization. Try again." };
  }

  revalidatePath("/platform");

  const inviteUrl = buildInviteUrl(token);

  const inviterLabel = session.user.name || session.user.email || "Platform admin";
  const emailResult = await sendInviteEmail({
    to: parsed.data.adminEmail,
    tenantName: parsed.data.organizationName,
    inviterLabel,
    inviteUrl,
    roleLabel: MembershipRole.ORG_ADMIN,
  });

  return {
    ok: true,
    tenantSlug: parsed.data.slug,
    inviteUrl,
    emailSent: emailResult.ok,
    ...(emailResult.ok ? {} : { emailError: emailResult.error }),
  };
}
