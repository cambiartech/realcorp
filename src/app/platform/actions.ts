"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { sendInviteEmail } from "@/lib/email";
import { buildInviteUrl, classifyInvite, inviteExpiresAt, newInviteToken } from "@/lib/invitation-utils";
import { pickBestErrorEvent } from "@/lib/platform-error-details";
import {
  deleteTenantInvitation,
  removeTenantMember,
} from "@/lib/platform-tenant-member-cleanup";
import { readTenantModuleFlagsFromForm } from "@/lib/tenant-module-definitions";
import { tenantModuleRevalidatePaths } from "@/lib/tenant-module-revalidate";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type InviteActionResult =
  { ok: true; inviteUrl: string; emailSent: boolean; emailError?: string } | { ok: false; error: string };

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

export async function platformRemoveTenantMember(
  tenantSlug: string,
  userId: string,
): Promise<{ ok: true; email: string | null } | { ok: false; error: string }> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate;

  const tenant = await loadTenantBySlug(tenantSlug);
  if (!tenant) return { ok: false, error: "Organization not found." };

  const result = await removeTenantMember({
    tenantId: tenant.id,
    userId,
    purgeUserAccount: false,
  });
  if (!result.ok) return result;

  revalidatePath(`/platform/tenants/${tenantSlug}`);
  revalidatePath("/platform");
  revalidatePath(`/${tenantSlug}/team`);
  return { ok: true, email: result.email };
}

export async function platformPurgeTenantMember(
  tenantSlug: string,
  userId: string,
): Promise<{ ok: true; email: string | null } | { ok: false; error: string }> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate;

  const tenant = await loadTenantBySlug(tenantSlug);
  if (!tenant) return { ok: false, error: "Organization not found." };

  const result = await removeTenantMember({
    tenantId: tenant.id,
    userId,
    purgeUserAccount: true,
  });
  if (!result.ok) return result;

  revalidatePath(`/platform/tenants/${tenantSlug}`);
  revalidatePath("/platform");
  revalidatePath(`/${tenantSlug}/team`);
  return { ok: true, email: result.email };
}

export async function platformDeleteInvitation(
  tenantSlug: string,
  invitationId: string,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate;

  const tenant = await loadTenantBySlug(tenantSlug);
  if (!tenant) return { ok: false, error: "Organization not found." };

  const result = await deleteTenantInvitation({ tenantId: tenant.id, invitationId });
  if (!result.ok) return result;

  revalidatePath(`/platform/tenants/${tenantSlug}`);
  revalidatePath("/platform");
  return { ok: true, email: result.email };
}

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
    best &&
    best.message &&
    !best.isSanitized &&
    (best.stack || !/Server Components render/i.test(best.message)),
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

type MoneyActionResult = { ok: true; message?: string } | { ok: false; error: string };

function actorFromSession(session: { user: { id?: string | null; name?: string | null; email?: string | null } }) {
  return {
    userId: session.user.id || "platform",
    label: session.user.name || session.user.email || "Platform admin",
  };
}

export async function platformRecordAndVerifyPayrollFunding(input: {
  tenantSlug: string;
  amount: string;
  paymentReference: string;
  senderName?: string;
  senderBank?: string;
  notes?: string;
}): Promise<MoneyActionResult> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate;

  const tenant = await loadTenantBySlug(input.tenantSlug);
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const { PayrollLedgerError, submitFundingReceipt, verifyFundingReceipt } = await import(
    "@/lib/payroll/disbursement"
  );

  try {
    await prisma.$transaction(async (tx) => {
      const receipt = await submitFundingReceipt(tx, {
        tenantId: tenant.id,
        amountNaira: input.amount,
        paymentReference: input.paymentReference,
        senderName: input.senderName,
        senderBank: input.senderBank,
        notes: input.notes,
        actor: actorFromSession(gate.session),
      });
      await verifyFundingReceipt(tx, {
        tenantId: tenant.id,
        receiptId: receipt.id,
        actor: actorFromSession(gate.session),
      });
    });
  } catch (err) {
    if (err instanceof PayrollLedgerError) return { ok: false, error: err.message };
    console.error("platformRecordAndVerifyPayrollFunding", err);
    return { ok: false, error: "Could not credit funding. No partial credit was applied." };
  }

  revalidatePath(`/platform/tenants/${tenant.slug}`);
  revalidatePath(`/${tenant.slug}/hr`);
  return { ok: true, message: "Funding verified and Available balance credited." };
}

export async function platformVerifyPayrollFunding(input: {
  tenantSlug: string;
  receiptId: string;
}): Promise<MoneyActionResult> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate;

  const tenant = await loadTenantBySlug(input.tenantSlug);
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const { PayrollLedgerError, verifyFundingReceipt } = await import("@/lib/payroll/disbursement");

  try {
    await prisma.$transaction(async (tx) => {
      await verifyFundingReceipt(tx, {
        tenantId: tenant.id,
        receiptId: input.receiptId,
        actor: actorFromSession(gate.session),
      });
    });
  } catch (err) {
    if (err instanceof PayrollLedgerError) return { ok: false, error: err.message };
    console.error("platformVerifyPayrollFunding", err);
    return { ok: false, error: "Could not verify funding." };
  }

  revalidatePath(`/platform/tenants/${tenant.slug}`);
  revalidatePath(`/${tenant.slug}/hr`);
  return { ok: true, message: "Funding verified." };
}

export async function platformRejectPayrollFunding(input: {
  tenantSlug: string;
  receiptId: string;
  reason: string;
}): Promise<MoneyActionResult> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate;

  const tenant = await loadTenantBySlug(input.tenantSlug);
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const { PayrollLedgerError, rejectFundingReceipt } = await import("@/lib/payroll/disbursement");

  try {
    await prisma.$transaction(async (tx) => {
      await rejectFundingReceipt(tx, {
        tenantId: tenant.id,
        receiptId: input.receiptId,
        reason: input.reason,
        actor: actorFromSession(gate.session),
      });
    });
  } catch (err) {
    if (err instanceof PayrollLedgerError) return { ok: false, error: err.message };
    console.error("platformRejectPayrollFunding", err);
    return { ok: false, error: "Could not reject funding." };
  }

  revalidatePath(`/platform/tenants/${tenant.slug}`);
  return { ok: true, message: "Funding rejected." };
}

export async function platformSavePayrollDisbursementSettings(input: {
  tenantSlug: string;
  feeFlatNaira: number;
  feePercentBps: number;
  feeCapNaira?: number;
  fundingBankName?: string;
  fundingAccountNumber?: string;
  fundingAccountName?: string;
  fundingAccountLabel?: string;
  dvaProvider?: "PAYSTACK" | "FLUTTERWAVE" | "";
  dvaAccountNumber?: string;
  dvaBankName?: string;
  dvaAccountName?: string;
  dvaBankCode?: string;
  dvaProviderAccountId?: string;
  dvaCustomerCode?: string;
  dvaPurpose?: string;
  dvaNotes?: string;
}): Promise<MoneyActionResult> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate;

  const tenant = await loadTenantBySlug(input.tenantSlug);
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const { payrollDisbursementSettingsSchema, parsePayrollDisbursementSettings } = await import(
    "@/lib/payroll/disbursement"
  );

  const existing = await prisma.tenantSettings.findUnique({
    where: { tenantId: tenant.id },
    select: { payrollDisbursementSettings: true },
  });
  const current = parsePayrollDisbursementSettings(existing?.payrollDisbursementSettings);

  const parsed = payrollDisbursementSettingsSchema.safeParse({
    feeFlatNaira: input.feeFlatNaira,
    feePercentBps: input.feePercentBps,
    feeCapNaira: input.feeCapNaira,
    activeProvider: current.activeProvider ?? null,
    fundingBankName: input.fundingBankName || "",
    fundingAccountNumber: input.fundingAccountNumber || "",
    fundingAccountName: input.fundingAccountName || "",
    fundingAccountLabel: input.fundingAccountLabel || "",
    dvaProvider: input.dvaProvider ?? current.dvaProvider ?? "PAYSTACK",
    dvaAccountNumber: input.dvaAccountNumber ?? "",
    dvaBankName: input.dvaBankName ?? "",
    dvaAccountName: input.dvaAccountName ?? "",
    dvaBankCode: input.dvaBankCode ?? "",
    dvaProviderAccountId: input.dvaProviderAccountId ?? "",
    dvaCustomerCode: input.dvaCustomerCode ?? "",
    dvaPurpose: input.dvaPurpose || "PAYROLL_FLOAT",
    dvaNotes: input.dvaNotes ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid settings." };
  }

  await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      payrollDisbursementSettings: parsed.data,
    },
    update: {
      payrollDisbursementSettings: parsed.data,
    },
  });

  revalidatePath(`/platform/tenants/${tenant.slug}`);
  revalidatePath("/platform/payroll");
  revalidatePath(`/${tenant.slug}/hr`);
  return { ok: true, message: "Disbursement & DVA settings saved." };
}

export async function platformPaystackStatus(): Promise<
  | {
      ok: true;
      configured: boolean;
      keyMode: "test" | "live" | "unknown" | "missing";
      balances: Array<{ currency: string; balanceLabel: string }>;
      balanceError?: string;
      webhookPath: string;
    }
  | { ok: false; error: string }
> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate;

  const { isPaystackConfigured, paystackGetBalances, koboToNairaString } = await import(
    "@/lib/payroll/disbursement"
  );
  const key = process.env.PAYSTACK_SECRET_KEY?.trim() || "";
  const configured = isPaystackConfigured();
  let keyMode: "test" | "live" | "unknown" | "missing" = "missing";
  if (key.startsWith("sk_test_")) keyMode = "test";
  else if (key.startsWith("sk_live_")) keyMode = "live";
  else if (key) keyMode = "unknown";

  const balances: Array<{ currency: string; balanceLabel: string }> = [];
  let balanceError: string | undefined;
  if (configured) {
    const res = await paystackGetBalances();
    if (!res.ok) {
      balanceError = res.error;
    } else {
      for (const row of res.data || []) {
        // Paystack returns balance in kobo for NGN
        const label =
          row.currency === "NGN"
            ? koboToNairaString(Math.max(0, Math.trunc(row.balance)))
            : String(row.balance);
        balances.push({ currency: row.currency, balanceLabel: label });
      }
    }
  }

  return {
    ok: true,
    configured,
    keyMode,
    balances,
    balanceError,
    webhookPath: "/api/webhooks/paystack",
  };
}

export async function platformResolveSalaryAccount(input: {
  accountNumber: string;
  bankCode: string;
}): Promise<
  | { ok: true; accountNumber: string; accountName: string }
  | { ok: false; error: string }
> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate;

  const { normalizeNuban, normalizeBankCode } = await import("@/lib/payroll/disbursement");
  const { paystackResolveAccount } = await import("@/lib/payroll/disbursement/paystack");

  const nuban = normalizeNuban(input.accountNumber);
  if (!nuban.ok) return { ok: false, error: nuban.error };
  const code = normalizeBankCode(input.bankCode);
  if (!code.ok) return { ok: false, error: code.error };

  const res = await paystackResolveAccount(nuban.accountNumber, code.bankCode);
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    accountNumber: res.data.account_number,
    accountName: res.data.account_name,
  };
}

export async function platformDisbursePayslipRun(input: {
  tenantSlug: string;
  payslipRunId: string;
}): Promise<
  | { ok: true; batchId: string; success: number; failed: number; message: string }
  | { ok: false; error: string }
> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate;

  const tenant = await loadTenantBySlug(input.tenantSlug);
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const actor = {
    userId: gate.session.user!.id!,
    label: gate.session.user!.name || gate.session.user!.email || "Platform admin",
  };

  const { createDisbursementBatchFromRun, executeDisbursementBatch } = await import(
    "@/lib/payroll/disbursement"
  );

  const created = await createDisbursementBatchFromRun(tenant.id, input.payslipRunId, actor);
  if (!created.ok) return { ok: false, error: created.error };

  const executed = await executeDisbursementBatch(tenant.id, created.batchId, actor);
  if (!executed.ok) return { ok: false, error: executed.error };

  revalidatePath("/platform/payroll");
  revalidatePath(`/platform/tenants/${tenant.slug}`);
  revalidatePath(`/${tenant.slug}/hr/payslips`);

  return {
    ok: true,
    batchId: created.batchId,
    success: executed.success,
    failed: executed.failed,
    message: `Paystack batch ${created.batchId}: ${executed.success} ok, ${executed.failed} failed.`,
  };
}

