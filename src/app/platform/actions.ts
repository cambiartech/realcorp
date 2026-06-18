"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { sendInviteEmail } from "@/lib/email";
import {
  buildInviteUrl,
  classifyInvite,
  inviteExpiresAt,
  newInviteToken,
} from "@/lib/invitation-utils";
import { pickBestErrorEvent } from "@/lib/platform-error-details";
import { readTenantModuleFlagsFromForm } from "@/lib/tenant-module-definitions";
import { tenantModuleRevalidatePaths } from "@/lib/tenant-module-revalidate";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type InviteActionResult =
  | { ok: true; inviteUrl: string; emailSent: boolean; emailError?: string }
  | { ok: false; error: string };

async function requirePlatformAdmin() {
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) {
    return { ok: false as const, error: "Only platform administrators can do this." };
  }
  return { ok: true as const, session };
}

async function loadTenantBySlug(tenantSlug: string) {
  return prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, name: true, slug: true },
  });
}

async function deliverInviteEmail(input: {
  to: string;
  tenantName: string;
  role: MembershipRole;
  token: string;
  actorLabel: string;
}) {
  const inviteUrl = buildInviteUrl(input.token);
  const emailResult = await sendInviteEmail({
    to: input.to,
    tenantName: input.tenantName,
    inviterLabel: input.actorLabel,
    inviteUrl,
    roleLabel: input.role,
  });
  return {
    inviteUrl,
    emailSent: emailResult.ok,
    emailError: emailResult.ok ? undefined : emailResult.error,
  };
}

export async function platformResendInvitation(
  tenantSlug: string,
  invitationId: string,
): Promise<InviteActionResult> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate;

  const tenant = await loadTenantBySlug(tenantSlug);
  if (!tenant) return { ok: false, error: "Organization not found." };

  const invite = await prisma.invitation.findFirst({
    where: { id: invitationId, tenantId: tenant.id, acceptedAt: null },
    select: { id: true, token: true, email: true, role: true, expiresAt: true },
  });
  if (!invite) return { ok: false, error: "Pending invite not found." };

  let token = invite.token;
  if (invite.expiresAt <= new Date()) {
    token = newInviteToken();
    await prisma.invitation.update({
      where: { id: invite.id },
      data: { token, expiresAt: inviteExpiresAt() },
    });
  }

  const actorLabel = gate.session.user!.name || gate.session.user!.email || "Platform admin";
  const delivered = await deliverInviteEmail({
    to: invite.email,
    tenantName: tenant.name,
    role: invite.role,
    token,
    actorLabel,
  });

  revalidatePath(`/platform/tenants/${tenantSlug}`);
  revalidatePath("/platform");
  return {
    ok: true,
    inviteUrl: delivered.inviteUrl,
    emailSent: delivered.emailSent,
    ...(delivered.emailError ? { emailError: delivered.emailError } : {}),
  };
}

export async function platformRefreshInvitationToken(
  tenantSlug: string,
  invitationId: string,
): Promise<InviteActionResult> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate;

  const tenant = await loadTenantBySlug(tenantSlug);
  if (!tenant) return { ok: false, error: "Organization not found." };

  const invite = await prisma.invitation.findFirst({
    where: { id: invitationId, tenantId: tenant.id, acceptedAt: null },
    select: { id: true, email: true, role: true },
  });
  if (!invite) return { ok: false, error: "Pending invite not found." };

  const token = newInviteToken();
  await prisma.invitation.update({
    where: { id: invite.id },
    data: { token, expiresAt: inviteExpiresAt() },
  });

  const actorLabel = gate.session.user!.name || gate.session.user!.email || "Platform admin";
  const delivered = await deliverInviteEmail({
    to: invite.email,
    tenantName: tenant.name,
    role: invite.role,
    token,
    actorLabel,
  });

  revalidatePath(`/platform/tenants/${tenantSlug}`);
  revalidatePath("/platform");
  return {
    ok: true,
    inviteUrl: delivered.inviteUrl,
    emailSent: delivered.emailSent,
    ...(delivered.emailError ? { emailError: delivered.emailError } : {}),
  };
}

const createAdminInviteSchema = z.string().trim().email("Enter a valid email address.");

export async function platformCreateAdminInvite(
  tenantSlug: string,
  email: string,
): Promise<InviteActionResult> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate;

  const parsed = createAdminInviteSchema.safeParse(email);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid email." };

  const tenant = await loadTenantBySlug(tenantSlug);
  if (!tenant) return { ok: false, error: "Organization not found." };

  const normalizedEmail = parsed.data.toLowerCase();
  const token = newInviteToken();

  const existingPending = await prisma.invitation.findFirst({
    where: { tenantId: tenant.id, email: normalizedEmail, acceptedAt: null },
    select: { id: true },
  });

  if (existingPending) {
    await prisma.invitation.update({
      where: { id: existingPending.id },
      data: { token, expiresAt: inviteExpiresAt(), role: MembershipRole.ORG_ADMIN },
    });
  } else {
    await prisma.invitation.create({
      data: {
        tenantId: tenant.id,
        email: normalizedEmail,
        role: MembershipRole.ORG_ADMIN,
        token,
        expiresAt: inviteExpiresAt(),
      },
    });
  }

  const actorLabel = gate.session.user!.name || gate.session.user!.email || "Platform admin";
  const delivered = await deliverInviteEmail({
    to: normalizedEmail,
    tenantName: tenant.name,
    role: MembershipRole.ORG_ADMIN,
    token,
    actorLabel,
  });

  revalidatePath(`/platform/tenants/${tenantSlug}`);
  revalidatePath("/platform");
  return {
    ok: true,
    inviteUrl: delivered.inviteUrl,
    emailSent: delivered.emailSent,
    ...(delivered.emailError ? { emailError: delivered.emailError } : {}),
  };
}

export async function platformLookupInviteToken(token: string): Promise<
  | {
      ok: true;
      status: "valid" | "expired" | "accepted" | "not_found";
      tenantName: string | null;
      email: string | null;
      expiresAt: string | null;
      acceptedAt: string | null;
    }
  | { ok: false; error: string }
> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate;

  const trimmed = token.trim();
  if (!trimmed) return { ok: false, error: "Paste an invite token." };

  const invite = await prisma.invitation.findUnique({
    where: { token: trimmed },
    include: { tenant: { select: { name: true } } },
  });

  const status = classifyInvite(invite);
  return {
    ok: true,
    status,
    tenantName: invite?.tenant.name ?? null,
    email: invite?.email ?? null,
    expiresAt: invite ? invite.expiresAt.toISOString() : null,
    acceptedAt: invite?.acceptedAt?.toISOString() ?? null,
  };
}

export async function platformLookupErrorReference(reference: string): Promise<
  | {
      ok: true;
      digest: string;
      count: number;
      hasActionableDetail: boolean;
      bestEvent: {
        id: string;
        createdAt: string;
        tenantSlug: string | null;
        tenantName: string | null;
        routePath: string | null;
        requestUrl: string | null;
        name: string | null;
        message: string | null;
        userEmail: string | null;
        userAgent: string | null;
        stack: string | null;
        source: string | null;
      } | null;
      events: Array<{
        id: string;
        createdAt: string;
        tenantSlug: string | null;
        tenantName: string | null;
        routePath: string | null;
        requestUrl: string | null;
        name: string | null;
        message: string | null;
        userEmail: string | null;
        userAgent: string | null;
        stack: string | null;
        source: string | null;
        isSanitized: boolean;
      }>;
    }
  | { ok: false; error: string }
> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate;

  const digest = reference.trim().replace(/\s+/g, "");
  if (!digest) return { ok: false, error: "Paste an error reference." };

  const [count, events] = await Promise.all([
    prisma.platformErrorEvent.count({ where: { digest } }),
    prisma.platformErrorEvent.findMany({
      where: { digest },
      include: {
        tenant: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  if (count === 0) {
    return { ok: false, error: "No matching error reports yet for this reference." };
  }

  const mapped = events.map((event) => {
    const meta = event.metadata as { source?: string } | null;
    const source = meta?.source ?? null;
    const isSanitized =
      Boolean(event.message && /omitted in production builds/i.test(event.message)) ||
      source === "global-error-boundary" ||
      source === "tenant-error-boundary";
    return {
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      tenantSlug: event.tenant?.slug ?? event.tenantSlug ?? null,
      tenantName: event.tenant?.name ?? null,
      routePath: event.routePath,
      requestUrl: event.requestUrl,
      name: event.name,
      message: event.message,
      userEmail: event.userEmail,
      userAgent: event.userAgent,
      stack: event.stack,
      source,
      isSanitized,
      metadata: event.metadata,
    };
  });

  const best = pickBestErrorEvent(mapped);
  const hasActionableDetail = Boolean(
    best && best.message && !best.isSanitized && (best.stack || !/Server Components render/i.test(best.message)),
  );

  return {
    ok: true,
    digest,
    count,
    hasActionableDetail,
    bestEvent: best
      ? {
          id: best.id,
          createdAt: best.createdAt,
          tenantSlug: best.tenantSlug,
          tenantName: best.tenantName,
          routePath: best.routePath,
          requestUrl: best.requestUrl,
          name: best.name,
          message: best.message,
          userEmail: best.userEmail,
          userAgent: best.userAgent,
          stack: best.stack,
          source: best.source,
        }
      : null,
    events: mapped.map(({ metadata: _m, ...rest }) => rest),
  };
}

export async function updateTenantShortLetsAddon(tenantId: string, enabled: boolean) {
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) {
    return { ok: false, error: "Only platform admins can update add-ons." };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, settings: { select: { id: true } } },
  });
  if (!tenant) return { ok: false, error: "Tenant not found." };

  if (tenant.settings) {
    await prisma.tenantSettings.update({
      where: { tenantId: tenant.id },
      data: { moduleShortLets: enabled },
    });
  } else {
    await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        moduleShortLets: enabled,
      },
    });
  }

  revalidatePath("/platform");
  for (const path of tenantModuleRevalidatePaths(tenant.slug, { moduleShortLets: enabled })) {
    revalidatePath(path);
  }
  return { ok: true };
}

export async function updateTenantModulesFromPlatform(tenantId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) {
    return { ok: false, error: "Only platform admins can update tenant modules." };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, settings: { select: { id: true } } },
  });
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const modules = readTenantModuleFlagsFromForm(formData);

  if (tenant.settings) {
    await prisma.tenantSettings.update({
      where: { tenantId: tenant.id },
      data: modules,
    });
  } else {
    await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        ...modules,
      },
    });
  }

  revalidatePath("/platform");
  for (const path of tenantModuleRevalidatePaths(tenant.slug, modules)) {
    revalidatePath(path);
  }
  return { ok: true };
}
