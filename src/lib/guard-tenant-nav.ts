import type { Session } from "next-auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { notFound } from "next/navigation";
import {
  canAccessNavKey,
  normalizeSettingsNavSlice,
  type TenantNavKey,
  type TenantSettingsNavSlice,
} from "@/lib/tenant-nav-access";

type MembershipSlice = { role: MembershipRole; status: MembershipStatus } | null;

export function assertTenantNavAccess(
  session: Session | null,
  membership: MembershipSlice,
  settings: Partial<TenantSettingsNavSlice> | null | undefined,
  required: TenantNavKey,
) {
  if (!session?.user?.id) notFound();
  const active = session.user.isPlatformAdmin || membership?.status === MembershipStatus.ACTIVE;
  if (!active) notFound();
  const normalized = normalizeSettingsNavSlice(settings);
  if (
    !canAccessNavKey(required, {
      role: membership?.role,
      isPlatformAdmin: Boolean(session.user.isPlatformAdmin),
      settings: normalized,
    })
  ) {
    notFound();
  }
}
