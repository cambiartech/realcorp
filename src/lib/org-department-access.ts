import { MembershipRole } from "@/generated/prisma";
import { mergeOrgDepartments, normalizeOrgDepartmentName } from "@/lib/org-departments";
import {
  ORG_DEPARTMENT_OPTIONS,
  mapOrgDepartmentToAccess,
  resolveMembershipRole,
} from "@/lib/org-membership-profile";

export { mapOrgDepartmentToAccess };

export function inviteDepartmentChoices(orgDepartments: string[]): { value: string; label: string }[] {
  const seen = new Set<string>();
  const out: { value: string; label: string }[] = [];

  for (const name of mergeOrgDepartments(orgDepartments)) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ value: name, label: name });
  }

  for (const option of ORG_DEPARTMENT_OPTIONS) {
    const already = out.some(
      (row) =>
        mapOrgDepartmentToAccess(row.value) === option.value ||
        row.label.toLowerCase() === option.label.toLowerCase(),
    );
    if (already) continue;
    out.push({ value: option.value, label: option.label });
  }

  return out.sort((a, b) => a.label.localeCompare(b.label));
}

export function resolveInviteDepartmentRole(
  name: string,
  isDepartmentLead: boolean,
): {
  storedDepartment: string;
  role: MembershipRole;
} {
  const storedDepartment = normalizeOrgDepartmentName(name);
  const access = mapOrgDepartmentToAccess(storedDepartment);
  if (access) {
    return {
      storedDepartment,
      role: resolveMembershipRole({
        kind: "department",
        department: access,
        isDepartmentLead,
      }),
    };
  }
  return {
    storedDepartment,
    role: isDepartmentLead ? MembershipRole.FACILITY_MANAGER : MembershipRole.FACILITY_STAFF,
  };
}
