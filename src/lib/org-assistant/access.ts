import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import type { AssistantModules } from "@/lib/org-assistant/tools";

type SettingsSlice = {
  moduleAi?: boolean | null;
  moduleSales?: boolean | null;
  moduleFinance?: boolean | null;
  moduleHr?: boolean | null;
  moduleShortLets?: boolean | null;
  moduleTasks?: boolean | null;
} | null | undefined;

const ASSISTANT_ROLES: MembershipRole[] = [
  MembershipRole.ORG_ADMIN,
  MembershipRole.SUB_ADMIN,
  MembershipRole.HR_MANAGER,
];

/** Org-wide data analysis for org admins, sub admins, HR managers and platform admins, only when AI is on for the org. */
export function canUseOrgAssistant(
  isPlatformAdmin: boolean,
  membership: { status: MembershipStatus; role: MembershipRole } | null | undefined,
  settings: SettingsSlice,
): boolean {
  if (!settings?.moduleAi) return false;
  if (isPlatformAdmin) return true;
  return Boolean(
    membership && membership.status === MembershipStatus.ACTIVE && ASSISTANT_ROLES.includes(membership.role),
  );
}

export function assistantModules(settings: SettingsSlice): AssistantModules {
  return {
    sales: settings?.moduleSales ?? true,
    finance: settings?.moduleFinance ?? true,
    hr: Boolean(settings?.moduleHr),
    shortlets: Boolean(settings?.moduleShortLets),
    tasks: settings?.moduleTasks ?? true,
  };
}
