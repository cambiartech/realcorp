export const DEFAULT_ORG_DEPARTMENTS = ["Finance", "Sales", "Marketing", "Community"] as const;

export function normalizeOrgDepartmentName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function mergeOrgDepartments(existing: string[] | null | undefined): string[] {
  return Array.from(
    new Set(
      [...(existing ?? []), ...DEFAULT_ORG_DEPARTMENTS].map(normalizeOrgDepartmentName).filter(Boolean),
    ),
  );
}

export function isDefaultOrgDepartment(name: string): boolean {
  const n = normalizeOrgDepartmentName(name).toLowerCase();
  return DEFAULT_ORG_DEPARTMENTS.some((department) => department.toLowerCase() === n);
}
