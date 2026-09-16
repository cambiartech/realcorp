export const DEFAULT_ORG_JOB_ROLES = [
  "Digital Marketer",
  "Graphics Designer",
  "Sales Executive",
  "Accountant",
  "HR Officer",
  "Operations Officer",
] as const;

export function normalizeOrgJobRoleName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function mergeOrgJobRoles(existing: string[] | null | undefined): string[] {
  return Array.from(
    new Set(
      [...(existing ?? []), ...DEFAULT_ORG_JOB_ROLES].map(normalizeOrgJobRoleName).filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

export function isDefaultOrgJobRole(name: string): boolean {
  const n = normalizeOrgJobRoleName(name).toLowerCase();
  return DEFAULT_ORG_JOB_ROLES.some((role) => role.toLowerCase() === n);
}
