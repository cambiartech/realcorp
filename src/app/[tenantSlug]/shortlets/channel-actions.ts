"use server";

import { auth } from "@/auth";
import { ChannelProvider, MembershipRole, MembershipStatus } from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import { INBOUND_CALENDAR_PROVIDERS, syncCalendarImport } from "@/lib/channels/sync-import";
import { generateChannelToken } from "@/lib/channels/tokens";
import { publicHttpsUrl } from "@/lib/channels/public-url";
import prisma from "@/lib/db";
import { canManageShortLets, type ShortletsAccessContext } from "@/lib/shortlets-access";
import { revalidateShortletsPaths } from "@/lib/shortlets-loaders";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true; token?: string; tenantId?: string } | { ok: false; error: string };

async function requireManager(tenantSlug: string): Promise<
  | { ok: false; error: string }
  | { ok: true; tenantId: string; userId: string; actorLabel: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in required." };
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) return { ok: false, error: "Organization not found." };
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true, role: true, modulePermissions: true },
  });
  const access: ShortletsAccessContext = {
    isPlatformAdmin: Boolean(session.user.isPlatformAdmin),
    membership: membership as {
      status: MembershipStatus;
      role: MembershipRole;
      modulePermissions?: unknown;
    } | null,
  };
  if (!canManageShortLets(access)) return { ok: false, error: "No permission to manage short lets." };
  return {
    ok: true,
    tenantId: tenant.id,
    userId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Short lets",
  };
}

function refresh(tenantSlug: string) {
  for (const path of revalidateShortletsPaths(tenantSlug)) revalidatePath(path);
}

async function issueToken(input: {
  tenantId: string;
  userId: string;
  actorLabel: string;
  tenantSlug: string;
  summary: string;
}): Promise<ActionResult> {
  const token = generateChannelToken();
  await prisma.channelConnection.upsert({
    where: { tenantId_provider: { tenantId: input.tenantId, provider: ChannelProvider.PELLOWS } },
    create: {
      tenantId: input.tenantId,
      provider: ChannelProvider.PELLOWS,
      status: "ACTIVE",
      tokenHash: token.hash,
      tokenPrefix: token.prefix,
      scopes: "shortlets.read",
      createdByUserId: input.userId,
    },
    update: {
      status: "ACTIVE",
      tokenHash: token.hash,
      tokenPrefix: token.prefix,
      scopes: "shortlets.read",
      revokedAt: null,
      createdByUserId: input.userId,
    },
  });
  await writeAuditLog({
    tenantId: input.tenantId,
    actorUserId: input.userId,
    actorLabel: input.actorLabel,
    module: "SHORTLETS",
    entityType: "CHANNEL_CONNECTION",
    action: "CONNECT",
    summary: input.summary,
  });
  refresh(input.tenantSlug);
  return { ok: true, token: token.raw, tenantId: input.tenantId };
}

export async function enablePellowsChannel(tenantSlug: string, consent: boolean): Promise<ActionResult> {
  if (!consent) return { ok: false, error: "Confirm what Pellows is allowed to read before turning it on." };
  const actor = await requireManager(tenantSlug);
  if (!actor.ok) return actor;
  const existing = await prisma.channelConnection.findUnique({
    where: { tenantId_provider: { tenantId: actor.tenantId, provider: ChannelProvider.PELLOWS } },
    select: { status: true },
  });
  if (existing?.status === "ACTIVE") {
    return { ok: false, error: "Pellows is already on. Rotate the token if you need a new one." };
  }
  return issueToken({
    ...actor,
    tenantSlug,
    summary: "Turned on Pellows for this workspace.",
  });
}

export async function rotatePellowsChannelToken(tenantSlug: string): Promise<ActionResult> {
  const actor = await requireManager(tenantSlug);
  if (!actor.ok) return actor;
  return issueToken({
    ...actor,
    tenantSlug,
    summary: "Rotated the Pellows connection token.",
  });
}

export async function revokePellowsChannel(tenantSlug: string): Promise<ActionResult> {
  const actor = await requireManager(tenantSlug);
  if (!actor.ok) return actor;
  const existing = await prisma.channelConnection.findUnique({
    where: { tenantId_provider: { tenantId: actor.tenantId, provider: ChannelProvider.PELLOWS } },
    select: { id: true, status: true },
  });
  if (!existing || existing.status !== "ACTIVE") return { ok: false, error: "Pellows is already off." };
  const discarded = generateChannelToken();
  await prisma.channelConnection.update({
    where: { id: existing.id },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      tokenHash: discarded.hash,
      tokenPrefix: "revoked",
    },
  });
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    actorLabel: actor.actorLabel,
    module: "SHORTLETS",
    entityType: "CHANNEL_CONNECTION",
    entityId: existing.id,
    action: "REVOKE",
    summary: "Turned off Pellows. The previous token no longer works.",
  });
  refresh(tenantSlug);
  return { ok: true };
}

export async function saveChannelCalendarImport(
  tenantSlug: string,
  input: { unitId: string; provider: string; icalUrl: string },
): Promise<ActionResult> {
  const actor = await requireManager(tenantSlug);
  if (!actor.ok) return actor;
  const provider = input.provider as ChannelProvider;
  if (!INBOUND_CALENDAR_PROVIDERS.includes(provider)) {
    return { ok: false, error: "Choose Airbnb, Booking.com, or another calendar." };
  }
  const icalUrl = publicHttpsUrl(input.icalUrl || "");
  if (!icalUrl) return { ok: false, error: "Paste a public https calendar link." };
  const unit = await prisma.shortletUnit.findFirst({
    where: { id: input.unitId, tenantId: actor.tenantId, isActive: true },
    select: { id: true, name: true },
  });
  if (!unit) return { ok: false, error: "Apartment not found." };

  const row = await prisma.channelCalendarImport.upsert({
    where: { unitId_provider: { unitId: unit.id, provider } },
    create: { tenantId: actor.tenantId, unitId: unit.id, provider, icalUrl },
    update: { icalUrl, lastError: null },
    select: { id: true },
  });
  const synced = await syncCalendarImport(row.id);
  refresh(tenantSlug);
  if (!synced.ok) return { ok: false, error: synced.error };
  return { ok: true };
}

export async function syncChannelCalendarImport(tenantSlug: string, importId: string): Promise<ActionResult> {
  const actor = await requireManager(tenantSlug);
  if (!actor.ok) return actor;
  const row = await prisma.channelCalendarImport.findFirst({
    where: { id: importId, tenantId: actor.tenantId },
    select: { id: true },
  });
  if (!row) return { ok: false, error: "Calendar link not found." };
  const synced = await syncCalendarImport(row.id);
  refresh(tenantSlug);
  if (!synced.ok) return { ok: false, error: synced.error };
  return { ok: true };
}

export async function removeChannelCalendarImport(tenantSlug: string, importId: string): Promise<ActionResult> {
  const actor = await requireManager(tenantSlug);
  if (!actor.ok) return actor;
  const row = await prisma.channelCalendarImport.findFirst({
    where: { id: importId, tenantId: actor.tenantId },
    select: { id: true, unitId: true, provider: true },
  });
  if (!row) return { ok: false, error: "Calendar link not found." };
  await prisma.$transaction([
    prisma.channelExternalBlock.deleteMany({ where: { unitId: row.unitId, provider: row.provider } }),
    prisma.channelCalendarImport.delete({ where: { id: row.id } }),
  ]);
  refresh(tenantSlug);
  return { ok: true };
}
