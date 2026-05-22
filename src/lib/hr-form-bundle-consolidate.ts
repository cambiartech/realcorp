import { randomBytes } from "crypto";
import { HrFormRequestStatus, type HrFormRequest } from "@/generated/prisma";
import prisma from "@/lib/db";

type RequestRow = Pick<
  HrFormRequest,
  "id" | "employeeProfileId" | "recipientEmail" | "bundleToken" | "tenantId" | "createdAt"
>;

export function hrFormRequestGroupKey(
  r: Pick<HrFormRequest, "employeeProfileId" | "recipientEmail">,
): string | null {
  if (r.employeeProfileId) return `profile:${r.employeeProfileId}`;
  const email = r.recipientEmail?.trim().toLowerCase();
  if (email) return `email:${email}`;
  return null;
}

/** Assign one bundleToken to pending forms for the same person that were sent separately (legacy). */
export async function ensureBundleTokensForPendingRequests(requests: RequestRow[]): Promise<void> {
  const byGroup = new Map<string, RequestRow[]>();

  for (const r of requests) {
    if (r.bundleToken) continue;
    const key = hrFormRequestGroupKey(r);
    if (!key) continue;
    const list = byGroup.get(key) ?? [];
    list.push(r);
    byGroup.set(key, list);
  }

  for (const list of byGroup.values()) {
    if (list.length < 2) continue;
    const bundleToken = randomBytes(24).toString("base64url");
    await prisma.hrFormRequest.updateMany({
      where: { id: { in: list.map((x) => x.id) } },
      data: { bundleToken },
    });
    for (const r of list) {
      (r as RequestRow & { bundleToken?: string }).bundleToken = bundleToken;
    }
  }
}

/** If this request belongs to a multi-form group, ensure bundle token exists and return it. */
export async function resolveBundleTokenForFormRequest(
  req: Pick<HrFormRequest, "id" | "token" | "tenantId" | "employeeProfileId" | "recipientEmail" | "bundleToken">,
): Promise<string | null> {
  if (req.bundleToken) return req.bundleToken;

  const key = hrFormRequestGroupKey(req);
  if (!key) return null;

  const or: Array<{ employeeProfileId: string } | { recipientEmail: { equals: string; mode: "insensitive" } }> = [];
  if (req.employeeProfileId) or.push({ employeeProfileId: req.employeeProfileId });
  const email = req.recipientEmail?.trim();
  if (email) or.push({ recipientEmail: { equals: email, mode: "insensitive" } });
  if (or.length === 0) return null;

  const siblings = await prisma.hrFormRequest.findMany({
    where: {
      tenantId: req.tenantId,
      status: HrFormRequestStatus.PENDING,
      expiresAt: { gt: new Date() },
      OR: or,
    },
    select: {
      id: true,
      employeeProfileId: true,
      recipientEmail: true,
      bundleToken: true,
      tenantId: true,
      createdAt: true,
    },
  });

  if (siblings.length < 2) return null;

  const existing = siblings.find((s) => s.bundleToken)?.bundleToken;
  if (existing) {
    if (!siblings.every((s) => s.bundleToken === existing)) {
      await prisma.hrFormRequest.updateMany({
        where: { id: { in: siblings.map((s) => s.id) } },
        data: { bundleToken: existing },
      });
    }
    return existing;
  }

  await ensureBundleTokensForPendingRequests(siblings);
  const refreshed = await prisma.hrFormRequest.findUnique({
    where: { id: req.id },
    select: { bundleToken: true },
  });
  return refreshed?.bundleToken ?? null;
}
