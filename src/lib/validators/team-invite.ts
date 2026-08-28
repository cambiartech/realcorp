import { z } from "zod";
import { resolveInviteDepartmentRole } from "@/lib/org-department-access";
import { resolveMembershipRole } from "@/lib/org-membership-profile";

export const teamInviteSchema = z
  .object({
    email: z.string().trim().toLowerCase().min(1, "Email is required.").email("Enter a valid email address."),
    accessKind: z.enum(["org_admin", "department", "portal"]),
    department: z.string().trim().min(1).max(80).optional(),
    isDepartmentLead: z
      .union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal("")])
      .optional()
      .transform((v) => v === "on" || v === "true" || v === "1"),
    portalRole: z.enum(["investor", "listing_owner"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.accessKind === "department" && !data.department) {
      ctx.addIssue({ code: "custom", message: "Select a department.", path: ["department"] });
    }
    if (data.accessKind === "portal" && !data.portalRole) {
      ctx.addIssue({ code: "custom", message: "Select a portal access type.", path: ["portalRole"] });
    }
  });

export type TeamInviteFieldName = "email" | "accessKind" | "department" | "isDepartmentLead" | "portalRole";

export function parseTeamInviteForm(formData: FormData) {
  return teamInviteSchema.safeParse({
    email: formData.get("email"),
    accessKind: formData.get("accessKind") || "department",
    department: formData.get("department") || undefined,
    isDepartmentLead: formData.get("isDepartmentLead") ?? "",
    portalRole: formData.get("portalRole") || undefined,
  });
}

export function resolveRoleFromTeamInviteForm(data: z.infer<typeof teamInviteSchema>) {
  if (data.accessKind === "org_admin") {
    return resolveMembershipRole({ kind: "org_admin" });
  }
  if (data.accessKind === "portal") {
    return resolveMembershipRole({ kind: "portal", portalRole: data.portalRole! });
  }
  return resolveInviteDepartmentRole(data.department!, data.isDepartmentLead ?? false).role;
}

export function inviteProfileFromForm(data: z.infer<typeof teamInviteSchema>) {
  if (data.accessKind === "org_admin") {
    return { department: null as string | null, isDepartmentLead: true };
  }
  if (data.accessKind === "portal") {
    return { department: null as string | null, isDepartmentLead: false };
  }
  const resolved = resolveInviteDepartmentRole(data.department!, data.isDepartmentLead ?? false);
  return {
    department: resolved.storedDepartment,
    isDepartmentLead: data.isDepartmentLead ?? false,
  };
}

export function zodTeamInviteIssuesToFieldRecord(
  issues: z.ZodIssue[],
): Partial<Record<TeamInviteFieldName, string>> {
  const out: Partial<Record<TeamInviteFieldName, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (
      (key === "email" ||
        key === "accessKind" ||
        key === "department" ||
        key === "isDepartmentLead" ||
        key === "portalRole") &&
      !out[key]
    ) {
      out[key] = issue.message;
    }
  }
  return out;
}
