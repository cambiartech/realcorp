import type { CSSProperties } from "react";

export type TenantBranding = {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  orgEmail: string | null;
  orgPhone: string | null;
  orgAddressLine: string | null;
  orgCity: string | null;
  orgState: string | null;
  orgCountry: string | null;
};

const DEFAULT_PRIMARY = "#1e3a5f";
const DEFAULT_ACCENT = "#4f46e5";

function normalizeHex(color: string | null | undefined, fallback: string) {
  if (!color?.trim()) return fallback;
  const c = color.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(c)) return c;
  return fallback;
}

export function brandingFromSettings(
  companyName: string,
  settings:
    | {
        logoUrl?: string | null;
        primaryColor?: string | null;
        accentColor?: string | null;
        orgEmail?: string | null;
        orgPhone?: string | null;
        orgAddressLine?: string | null;
        orgCity?: string | null;
        orgState?: string | null;
        orgCountry?: string | null;
      }
    | null
    | undefined,
): TenantBranding {
  return {
    companyName,
    logoUrl: settings?.logoUrl ?? null,
    primaryColor: normalizeHex(settings?.primaryColor, DEFAULT_PRIMARY),
    accentColor: normalizeHex(settings?.accentColor, DEFAULT_ACCENT),
    orgEmail: settings?.orgEmail ?? null,
    orgPhone: settings?.orgPhone ?? null,
    orgAddressLine: settings?.orgAddressLine ?? null,
    orgCity: settings?.orgCity ?? null,
    orgState: settings?.orgState ?? null,
    orgCountry: settings?.orgCountry ?? "Nigeria",
  };
}

export function formatOrgAddress(brand: TenantBranding): string {
  const parts = [
    brand.orgAddressLine,
    [brand.orgCity, brand.orgState].filter(Boolean).join(", "),
    brand.orgCountry,
  ].filter(Boolean);
  return parts.join(" · ") || "";
}

export function brandingCssVars(brand: TenantBranding): CSSProperties {
  return {
    ["--hr-brand-primary" as string]: brand.primaryColor,
    ["--hr-brand-accent" as string]: brand.accentColor,
  };
}

/** Brand block for finance PDF generation (logo + org contact). */
export function financePdfBrandFromSettings(
  companyName: string,
  settings: Parameters<typeof brandingFromSettings>[1],
) {
  const brand = brandingFromSettings(companyName, settings);
  return {
    companyName: brand.companyName,
    logoUrl: brand.logoUrl,
    orgAddress: formatOrgAddress(brand) || null,
    orgEmail: brand.orgEmail,
    orgPhone: brand.orgPhone,
  };
}
