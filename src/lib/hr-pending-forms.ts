import { HrFormRequestStatus, type HrFormType } from "@/generated/prisma";
import prisma from "@/lib/db";
import { ensureBundleTokensForPendingRequests } from "@/lib/hr-form-bundle-consolidate";
import { HR_FORM_TYPE_LABELS, hrOnboardingBundlePath } from "@/lib/hr-form-types";
import { absoluteAppUrl } from "@/lib/app-url";

export type PendingFormItem =
  | {
      kind: "bundle";
      bundleToken: string;
      label: string;
      fillUrl: string;
      expiresAt: Date;
      total: number;
      completed: number;
    }
  | {
      kind: "single";
      id: string;
      formTypeLabel: string;
      fillUrl: string;
      expiresAt: Date;
    };

export type HrOnboardingStatusSummary =
  | { state: "none" }
  | {
      state: "pending";
      pendingCount: number;
      sectionLabels: string[];
      dueLabel: string | null;
      masterUrl: string | null;
    }
  | {
      state: "complete";
      submittedCount: number;
      totalCount: number;
      masterUrl: string | null;
      submittedAtLabel: string;
    };

function isDoneStatus(status: HrFormRequestStatus) {
  return status === HrFormRequestStatus.SUBMITTED || status === HrFormRequestStatus.APPROVED;
}

function dedupeByFormType<T extends { formType: HrFormType; createdAt: Date }>(rows: T[]): T[] {
  const byType = new Map<HrFormType, T>();
  for (const r of rows) {
    const prev = byType.get(r.formType);
    if (!prev || r.createdAt > prev.createdAt) byType.set(r.formType, r);
  }
  return [...byType.values()];
}

function buildPendingItems(
  pendingRows: Array<{
    id: string;
    formType: HrFormType;
    token: string;
    bundleToken: string | null;
    expiresAt: Date;
    createdAt: Date;
  }>,
  tenantSlug: string | undefined,
): PendingFormItem[] {
  const byBundle = new Map<string, typeof pendingRows>();
  const singles: typeof pendingRows = [];

  for (const r of pendingRows) {
    if (r.bundleToken) {
      const list = byBundle.get(r.bundleToken) ?? [];
      list.push(r);
      byBundle.set(r.bundleToken, list);
    } else {
      singles.push(r);
    }
  }

  const items: PendingFormItem[] = [];

  for (const [bundleToken, list] of byBundle) {
    const deduped = dedupeByFormType(list);
    items.push({
      kind: "bundle",
      bundleToken,
      label:
        deduped.length === 1
          ? HR_FORM_TYPE_LABELS[deduped[0]!.formType]
          : `Onboarding forms (${deduped.length} sections)`,
      fillUrl: absoluteAppUrl(
        hrOnboardingBundlePath(bundleToken, tenantSlug ? { tenant: tenantSlug } : undefined),
      ),
      expiresAt: deduped[0]!.expiresAt,
      total: deduped.length,
      completed: 0,
    });
  }

  for (const r of singles) {
    items.push({
      kind: "single",
      id: r.id,
      formTypeLabel: HR_FORM_TYPE_LABELS[r.formType],
      fillUrl: absoluteAppUrl(`/hr-form/${r.token}`),
      expiresAt: r.expiresAt,
    });
  }

  return items;
}

export async function loadHrOnboardingStatusForUser(
  tenantId: string,
  userId: string,
  email?: string | null,
): Promise<{
  pendingItems: PendingFormItem[];
  masterOnboardingUrl: string | null;
  summary: HrOnboardingStatusSummary;
}> {
  const profile = await prisma.employeeProfile.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { id: true },
  });

  const or: Array<{ employeeProfileId: string } | { recipientEmail: { equals: string; mode: "insensitive" } }> = [];
  if (profile) or.push({ employeeProfileId: profile.id });
  const normalizedEmail = email?.trim();
  if (normalizedEmail) {
    or.push({ recipientEmail: { equals: normalizedEmail, mode: "insensitive" } });
  }

  const tenantRow = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  const tenantSlug = tenantRow?.slug;

  if (or.length === 0) {
    return { pendingItems: [], masterOnboardingUrl: null, summary: { state: "none" } };
  }

  const now = new Date();
  const since = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);

  const allRequests = await prisma.hrFormRequest.findMany({
    where: {
      tenantId,
      AND: [
        { OR: or },
        {
          OR: [
            { status: HrFormRequestStatus.PENDING, expiresAt: { gt: now } },
            {
              status: { in: [HrFormRequestStatus.SUBMITTED, HrFormRequestStatus.APPROVED] },
              submittedAt: { gte: since },
            },
          ],
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      formType: true,
      token: true,
      bundleToken: true,
      expiresAt: true,
      createdAt: true,
      status: true,
      submittedAt: true,
      employeeProfileId: true,
      recipientEmail: true,
      tenantId: true,
    },
  });

  const submittedTypes = new Set(
    allRequests.filter((r) => isDoneStatus(r.status)).map((r) => r.formType),
  );

  const pendingRaw = allRequests.filter(
    (r) => r.status === HrFormRequestStatus.PENDING && r.expiresAt > now && !submittedTypes.has(r.formType),
  );

  const pendingDeduped = dedupeByFormType(pendingRaw);

  await ensureBundleTokensForPendingRequests(pendingDeduped);

  const pendingRefreshed = await prisma.hrFormRequest.findMany({
    where: { id: { in: pendingDeduped.map((r) => r.id) } },
    select: {
      id: true,
      formType: true,
      token: true,
      bundleToken: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  const pendingItems = buildPendingItems(pendingRefreshed, tenantSlug);
  const bundle = pendingItems.find((p) => p.kind === "bundle");
  const masterOnboardingUrl = bundle?.fillUrl ?? pendingItems[0]?.fillUrl ?? null;

  const submittedRows = dedupeByFormType(
    allRequests.filter((r) => isDoneStatus(r.status) && r.submittedAt),
  );

  if (pendingItems.length === 0 && submittedRows.length > 0) {
    const latestSubmit = submittedRows.reduce<Date | null>((max, r) => {
      const at = r.submittedAt!;
      return !max || at > max ? at : max;
    }, null);
    const bundleToken = submittedRows.find((r) => r.bundleToken)?.bundleToken;
    const masterUrl = bundleToken
      ? absoluteAppUrl(
          hrOnboardingBundlePath(bundleToken, tenantSlug ? { tenant: tenantSlug } : undefined),
        )
      : null;

    return {
      pendingItems: [],
      masterOnboardingUrl: null,
      summary: {
        state: "complete",
        submittedCount: submittedRows.length,
        totalCount: submittedRows.length,
        masterUrl,
        submittedAtLabel: latestSubmit
          ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(latestSubmit)
          : "—",
      },
    };
  }

  if (pendingItems.length === 0) {
    return { pendingItems: [], masterOnboardingUrl: null, summary: { state: "none" } };
  }

  const sectionLabels = pendingDeduped.map((r) => HR_FORM_TYPE_LABELS[r.formType]);
  const dueLabel = pendingDeduped[0]?.expiresAt
    ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(pendingDeduped[0].expiresAt)
    : null;

  return {
    pendingItems,
    masterOnboardingUrl,
    summary: {
      state: "pending",
      pendingCount: pendingDeduped.length,
      sectionLabels,
      dueLabel,
      masterUrl: masterOnboardingUrl,
    },
  };
}

/** @deprecated Use loadHrOnboardingStatusForUser */
export async function loadPendingFormsForUser(
  tenantId: string,
  userId: string,
  email?: string | null,
): Promise<PendingFormItem[]> {
  const { pendingItems } = await loadHrOnboardingStatusForUser(tenantId, userId, email);
  return pendingItems;
}
