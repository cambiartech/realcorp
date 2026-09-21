import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { MembershipRole, MembershipStatus, PayrollFundingStatus } from "@/generated/prisma";
import { buildInviteUrl, classifyInvite, inviteStatusLabel } from "@/lib/invitation-utils";
import { normalizeTenantModuleFlags, tenantModuleSummary } from "@/lib/tenant-module-definitions";
import { getAvailableBalanceNaira, parsePayrollDisbursementSettings } from "@/lib/payroll/disbursement";
import { PlatformModulesForm } from "../../modules-form";
import { TenantInvitesWorkspace, type PlatformInviteRow } from "./tenant-invites-workspace";
import { TenantMembersWorkspace, type PlatformMemberRow } from "./tenant-members-workspace";
import { InviteTokenLookup } from "../../invite-token-lookup";
import {
  PlatformPayrollFundingWorkspace,
  type PlatformFundingRow,
  type PlatformLedgerRow,
} from "./payroll-funding-workspace";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Organization invites · Platform",
};

function moneyLabel(value: { toString(): string } | string | number) {
  const n = Number(typeof value === "object" ? value.toString() : value);
  return Number.isFinite(n)
    ? n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";
}

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
      defaultCurrency: true,
      settings: true,
      invitations: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      memberships: {
        where: { status: MembershipStatus.ACTIVE },
        include: {
          user: {
            select: { id: true, name: true, email: true, isPlatformAdmin: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      payrollFundingReceipts: {
        where: { status: PayrollFundingStatus.PENDING },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      payrollLedgerEntries: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!tenant) notFound();

  const hasActiveOrgAdmin = tenant.memberships.some((m) => m.role === MembershipRole.ORG_ADMIN);

  const members: PlatformMemberRow[] = tenant.memberships.map((m) => ({
    membershipId: m.id,
    userId: m.user.id,
    name: m.user.name || m.user.email || "User",
    email: m.user.email || "",
    role: m.role.replaceAll("_", " "),
    department: m.department,
    isDepartmentLead: m.isDepartmentLead,
    joinedAtLabel: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(m.createdAt),
    isPlatformAdmin: m.user.isPlatformAdmin,
  }));

  const invites: PlatformInviteRow[] = tenant.invitations.map((invite) => {
    const status = classifyInvite(invite);
    const mappedStatus = status === "not_found" ? "expired" : status;
    return {
      id: invite.id,
      email: invite.email,
      role: invite.role.replaceAll("_", " "),
      status: mappedStatus,
      statusLabel: inviteStatusLabel(status),
      expiresAtLabel: new Intl.DateTimeFormat("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(invite.expiresAt),
      acceptedAtLabel: invite.acceptedAt
        ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(
            invite.acceptedAt,
          )
        : null,
      createdAtLabel: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(invite.createdAt),
      inviteUrl: status === "valid" ? buildInviteUrl(invite.token) : null,
      canResend: status === "valid" || status === "expired",
      canRefresh: status === "valid" || status === "expired",
    };
  });

  const availableBalanceLabel = moneyLabel(await getAvailableBalanceNaira(prisma, tenant.id));
  const disbursement = parsePayrollDisbursementSettings(tenant.settings?.payrollDisbursementSettings);

  const pendingFunding: PlatformFundingRow[] = tenant.payrollFundingReceipts.map((r) => ({
    id: r.id,
    amountLabel: moneyLabel(r.amount),
    paymentReference: r.paymentReference,
    status: r.status,
    senderName: r.senderName,
    createdAtLabel: new Intl.DateTimeFormat("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(r.createdAt),
    createdByLabel: r.createdByLabel,
    verifiedAtLabel: null,
  }));

  const recentLedger: PlatformLedgerRow[] = tenant.payrollLedgerEntries.map((e) => ({
    id: e.id,
    entryType: e.entryType,
    amountLabel: moneyLabel(e.amount),
    balanceAfterLabel: moneyLabel(e.balanceAfter),
    description: e.description,
    createdAtLabel: new Intl.DateTimeFormat("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(e.createdAt),
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/platform"
        className="text-sm text-muted underline underline-offset-2 hover:text-foreground"
      >
        ← All tenants
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-foreground">{tenant.name}</h1>
      <p className="mt-1 text-sm text-muted">
        Manage onboarding invites and module entitlements for{" "}
        <code className="font-mono text-xs">/{tenant.slug}</code>
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <PlatformModulesForm
          tenantId={tenant.id}
          tenantName={tenant.name}
          tenantSlug={tenant.slug}
          summary={tenantModuleSummary(tenant.settings)}
          initial={normalizeTenantModuleFlags(tenant.settings)}
        />
        <Link
          href={`/${tenant.slug}`}
          className="text-sm text-muted underline underline-offset-2 hover:text-foreground"
        >
          Open tenant workspace →
        </Link>
      </div>

      <div className="mt-8 space-y-8">
        <PlatformPayrollFundingWorkspace
          tenantSlug={tenant.slug}
          tenantId={tenant.id}
          availableBalanceLabel={availableBalanceLabel}
          currency={tenant.defaultCurrency || "NGN"}
          pending={pendingFunding}
          recentLedger={recentLedger}
          feeFlatNaira={disbursement.feeFlatNaira}
          feePercentBps={disbursement.feePercentBps}
          feeCapNaira={disbursement.feeCapNaira ?? ""}
          fundingBankName={disbursement.fundingBankName || ""}
          fundingAccountNumber={disbursement.fundingAccountNumber || ""}
          fundingAccountName={disbursement.fundingAccountName || ""}
          fundingAccountLabel={disbursement.fundingAccountLabel || ""}
        />
        <InviteTokenLookup />
        <TenantMembersWorkspace tenantSlug={tenant.slug} tenantName={tenant.name} members={members} />
        <TenantInvitesWorkspace
          tenantSlug={tenant.slug}
          tenantName={tenant.name}
          invites={invites}
          hasActiveOrgAdmin={hasActiveOrgAdmin}
        />
      </div>
    </div>
  );
}
