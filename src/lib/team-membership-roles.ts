import { MembershipRole } from "@/generated/prisma";
import { ORG_DEPARTMENT_OPTIONS } from "@/lib/org-membership-profile";

/** Simplified invite UI — department + lead toggle (legacy enum kept under the hood). */
export const INVITE_ACCESS_KIND_OPTIONS = [
  { value: "department", label: "Team member (department)" },
  { value: "org_admin", label: "Organization admin" },
  { value: "portal", label: "Investor / listing owner (portal only)" },
] as const;

export const INVITE_DEPARTMENT_OPTIONS = ORG_DEPARTMENT_OPTIONS;

export const INVITE_PORTAL_ROLE_OPTIONS = [
  { value: "investor", label: "Investor" },
  { value: "listing_owner", label: "Listing owner" },
] as const;

/** Member role dropdown — still maps to enum until member edit UI is migrated. */
export const TEAM_MEMBERSHIP_ROLE_OPTIONS: { value: MembershipRole; label: string }[] = [
  { value: MembershipRole.ORG_ADMIN, label: "Organization admin" },
  { value: MembershipRole.FINANCE_MANAGER, label: "Finance · Lead" },
  { value: MembershipRole.HR_MANAGER, label: "People (HR) · Lead" },
  { value: MembershipRole.SALES_MANAGER, label: "Sales · Lead" },
  { value: MembershipRole.SALES_EXECUTIVE, label: "Sales" },
  { value: MembershipRole.MARKETING_MANAGER, label: "Marketing · Lead" },
  { value: MembershipRole.COMMUNITY_MANAGER, label: "Community · Lead" },
  { value: MembershipRole.HOUSEKEEPING_MANAGER, label: "Operations · Lead" },
  { value: MembershipRole.FNB_STAFF, label: "Operations" },
  { value: MembershipRole.INVESTOR, label: "Investor (portal only)" },
  { value: MembershipRole.LISTING_OWNER, label: "Listing owner (portal only)" },
];
