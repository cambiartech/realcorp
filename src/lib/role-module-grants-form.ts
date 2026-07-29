import { MembershipRole } from "@/generated/prisma";

/**
 * Stored grant tokens — MARKETING/COMMUNITY/FINANCE map in tenant-nav-access;
 * SALES adds dashboard + projects + leads + deals when org moduleSales is on.
 */
export const EXTRA_MODULE_GRANT_TOKENS = ["SALES", "MARKETING", "COMMUNITY", "FINANCE"] as const;
export type ExtraModuleGrantToken = (typeof EXTRA_MODULE_GRANT_TOKENS)[number];

export const MEMBERSHIP_ROLES_FOR_GRANT_MATRIX = (Object.values(MembershipRole) as MembershipRole[]).filter(
  (r) => r !== MembershipRole.ORG_ADMIN,
);

export function grantFormFieldName(role: MembershipRole, token: ExtraModuleGrantToken) {
  return `grant_${role}_${token}`;
}

export function parseRoleModuleGrantsFromFormData(formData: FormData): Record<string, string[]> | null {
  const out: Record<string, string[]> = {};
  for (const role of MEMBERSHIP_ROLES_FOR_GRANT_MATRIX) {
    const picked: string[] = [];
    for (const token of EXTRA_MODULE_GRANT_TOKENS) {
      if (formData.get(grantFormFieldName(role, token)) === "on") {
        picked.push(token);
      }
    }
    if (picked.length) out[role] = picked;
  }
  return Object.keys(out).length ? out : null;
}

export function parseRoleGrantsJsonString(
  json: string,
): Partial<Record<MembershipRole, ExtraModuleGrantToken[]>> {
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    if (typeof o !== "object" || o === null || Array.isArray(o)) return {};
    const roles = Object.values(MembershipRole) as string[];
    const out: Partial<Record<MembershipRole, ExtraModuleGrantToken[]>> = {};
    const allowed = new Set<string>(EXTRA_MODULE_GRANT_TOKENS);
    for (const role of roles) {
      const v = o[role];
      if (!Array.isArray(v)) continue;
      const list: ExtraModuleGrantToken[] = [];
      for (const x of v) {
        const up = typeof x === "string" ? x.toUpperCase() : "";
        if (allowed.has(up)) list.push(up as ExtraModuleGrantToken);
      }
      if (list.length) out[role as MembershipRole] = list;
    }
    return out;
  } catch {
    return {};
  }
}
