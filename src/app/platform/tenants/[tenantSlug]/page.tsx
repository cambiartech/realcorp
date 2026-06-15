import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import {
  buildInviteUrl,
  classifyInvite,
  inviteStatusLabel,
} from "@/lib/invitation-utils";
import { normalizeTenantModuleFlags, tenantModuleSummary } from "@/lib/tenant-module-definitions";
import { PlatformModulesForm } from "../../modules-form";
import { TenantInvitesWorkspace, type PlatformInviteRow } from "./tenant-invites-workspace";
import { InviteTokenLookup } from "../../invite-token-lookup";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Organization invites · Platform",
};

export default async function PlatformTenantInvitesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) {
    redirect("/login?callbackUrl=/platform");
  }

  const { tenantSlug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      settings: true,
      invitations: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      memberships: {
        where: { role: MembershipRole.ORG_ADMIN, status: MembershipStatus.ACTIVE },
        select: { id: true },
      },
    },
  });
  if (!tenant) notFound();

  const invites: PlatformInviteRow[] = tenant.invitations.map((invite) => {
    const status = classifyInvite(invite);
    const mappedStatus = status === "not_found" ? "expired" : status;
    return {
      id: invite.id,
      email: invite.email,
      role: invite.role.replaceAll("_", " "),
      status: mappedStatus,
      statusLabel: inviteStatusLabel(status),
      expiresAtLabel: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(
        invite.expiresAt,
      ),
      acceptedAtLabel: invite.acceptedAt
        ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(invite.acceptedAt)
        : null,
      createdAtLabel: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(invite.createdAt),
      inviteUrl: status === "valid" ? buildInviteUrl(invite.token) : null,
      canResend: status === "valid" || status === "expired",
      canRefresh: status === "valid" || status === "expired",
    };
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/platform" className="text-sm text-muted underline underline-offset-2 hover:text-foreground">
        ← All tenants
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-foreground">{tenant.name}</h1>
      <p className="mt-1 text-sm text-muted">
        Manage onboarding invites and module entitlements for <code className="font-mono text-xs">/{tenant.slug}</code>
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <PlatformModulesForm
          tenantId={tenant.id}
          tenantName={tenant.name}
          tenantSlug={tenant.slug}
          summary={tenantModuleSummary(tenant.settings)}
          initial={normalizeTenantModuleFlags(tenant.settings)}
        />
        <Link href={`/${tenant.slug}`} className="text-sm text-muted underline underline-offset-2 hover:text-foreground">
          Open tenant workspace →
        </Link>
      </div>

      <div className="mt-8 space-y-8">
        <InviteTokenLookup />
        <TenantInvitesWorkspace
          tenantSlug={tenant.slug}
          tenantName={tenant.name}
          invites={invites}
          hasActiveOrgAdmin={tenant.memberships.length > 0}
        />
      </div>
    </div>
  );
}
