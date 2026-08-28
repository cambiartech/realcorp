export type OrgPayrollSettings = {
  payrollCountryCode: string;
  basicPercent: number;
  housingPercent: number;
  transportPercent: number;
  otherPercent: number;
  pensionEnabled: boolean;
  employeePensionRate: number;
  employerPensionRate: number;
  nsitfRate: number;
  itfRate: number;
};

export const DEFAULT_ORG_PAYROLL_SETTINGS: OrgPayrollSettings = {
  payrollCountryCode: "NG",
  basicPercent: 30,
  housingPercent: 20,
  transportPercent: 15,
  otherPercent: 35,
  pensionEnabled: true,
  employeePensionRate: 8,
  employerPensionRate: 10,
  nsitfRate: 1,
  itfRate: 0,
};

export const PAYROLL_COUNTRY_OPTIONS = [
  { value: "NG", label: "Nigeria — Tax Act 2026 (first ₦800,000 untaxed)" },
] as const;

function rateFromContributions(value: unknown, code: string, fallback: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const rows = (value as Record<string, unknown>).employerContributions;
  if (!Array.isArray(rows)) return fallback;
  const match = rows.find(
    (row) =>
      row &&
      typeof row === "object" &&
      !Array.isArray(row) &&
      (row as Record<string, unknown>).code === code,
  ) as Record<string, unknown> | undefined;
  return typeof match?.rate === "number" && Number.isFinite(match.rate) ? match.rate : fallback;
}

function num(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function parseOrgPayrollSettings(
  payrollCountryCode: string | null | undefined,
  payrollSettings: unknown,
): OrgPayrollSettings {
  const raw =
    payrollSettings && typeof payrollSettings === "object" && !Array.isArray(payrollSettings)
      ? (payrollSettings as Record<string, unknown>)
      : {};
  const split =
    raw.salarySplit && typeof raw.salarySplit === "object" && !Array.isArray(raw.salarySplit)
      ? (raw.salarySplit as Record<string, unknown>)
      : raw;
  return {
    payrollCountryCode: (payrollCountryCode || DEFAULT_ORG_PAYROLL_SETTINGS.payrollCountryCode)
      .trim()
      .toUpperCase() || "NG",
    basicPercent: num(split.basicPercent, DEFAULT_ORG_PAYROLL_SETTINGS.basicPercent),
    housingPercent: num(split.housingPercent, DEFAULT_ORG_PAYROLL_SETTINGS.housingPercent),
    transportPercent: num(split.transportPercent, DEFAULT_ORG_PAYROLL_SETTINGS.transportPercent),
    otherPercent: num(split.otherPercent, DEFAULT_ORG_PAYROLL_SETTINGS.otherPercent),
    pensionEnabled: raw.pensionEnabled !== false,
    employeePensionRate: num(raw.employeePensionRate, DEFAULT_ORG_PAYROLL_SETTINGS.employeePensionRate),
    employerPensionRate: num(raw.employerPensionRate, DEFAULT_ORG_PAYROLL_SETTINGS.employerPensionRate),
    nsitfRate: rateFromContributions(raw, "NSITF", DEFAULT_ORG_PAYROLL_SETTINGS.nsitfRate),
    itfRate: rateFromContributions(raw, "ITF", DEFAULT_ORG_PAYROLL_SETTINGS.itfRate),
  };
}

export function orgPayrollSettingsPayload(settings: OrgPayrollSettings, current: unknown) {
  const existing =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return {
    ...existing,
    salarySplit: {
      basicPercent: settings.basicPercent,
      housingPercent: settings.housingPercent,
      transportPercent: settings.transportPercent,
      otherPercent: settings.otherPercent,
    },
    pensionEnabled: settings.pensionEnabled,
    employeePensionRate: settings.employeePensionRate,
    employerPensionRate: settings.employerPensionRate,
    employerContributions: [
      { code: "NSITF", label: "Employee Compensation contribution", rate: settings.nsitfRate },
      { code: "ITF", label: "Industrial Training Fund", rate: settings.itfRate },
    ],
  };
}
