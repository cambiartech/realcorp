export function normalizeFinanceVendorName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function vendorNamesMatch(a: string, b: string): boolean {
  return normalizeFinanceVendorName(a).toLowerCase() === normalizeFinanceVendorName(b).toLowerCase();
}
