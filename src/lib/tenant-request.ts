import { cache } from "react";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { MEMBERSHIP_FOR_NAV_SELECT } from "@/lib/guard-tenant-nav";

/** One session lookup per server request (layout + page + loaders share it). */
export const getAuthSession = cache(async () => auth());

/** One tenant row per request. Includes settings so layouts and pages do not re-query. */
export const getTenantBySlug = cache(async (slug: string) =>
  prisma.tenant.findUnique({
    where: { slug },
    include: { settings: true },
  }),
);

export const getMembershipForUser = cache(async (tenantId: string, userId: string) =>
  prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: {
      ...MEMBERSHIP_FOR_NAV_SELECT,
      department: true,
      isDepartmentLead: true,
    },
  }),
);

export const loadTenantRequest = cache(async (tenantSlug: string) => {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return { session: null, tenant: null, membership: null } as const;
  }
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    return { session, tenant: null, membership: null } as const;
  }
  const membership = await getMembershipForUser(tenant.id, session.user.id);
  return { session, tenant, membership } as const;
});
