import { MembershipRole } from "@/generated/prisma";

/** Labels for role pickers (invites + member role changes). */
export const TEAM_MEMBERSHIP_ROLE_OPTIONS: { value: MembershipRole; label: string }[] = [
  { value: MembershipRole.ORG_ADMIN, label: "Org admin" },
  { value: MembershipRole.FINANCE_MANAGER, label: "Finance manager" },
  { value: MembershipRole.HR_MANAGER, label: "HR manager" },
  { value: MembershipRole.SALES_MANAGER, label: "Sales manager" },
  { value: MembershipRole.SALES_EXECUTIVE, label: "Sales executive" },
  { value: MembershipRole.MARKETING_MANAGER, label: "Marketing manager" },
  { value: MembershipRole.COMMUNITY_MANAGER, label: "Community manager" },
  { value: MembershipRole.HOUSEKEEPING_MANAGER, label: "Housekeeping manager" },
  { value: MembershipRole.FNB_STAFF, label: "Kitchen / F&B staff" },
  { value: MembershipRole.INVESTOR, label: "Investor (portal only)" },
  { value: MembershipRole.LISTING_OWNER, label: "Listing owner (portal only)" },
];
