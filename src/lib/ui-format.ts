export function formatEnumLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const UNIT_PURPOSE_LABELS: Record<string, string> = {
  SALE: "For sale",
  SHORT_LET: "Short let",
  RENTAL: "Rental",
  HOSTEL: "Hostel",
};

/** Display label for inventory unit purpose (sale vs rental use cases). */
export function formatUnitPurpose(value: string): string {
  return UNIT_PURPOSE_LABELS[value] ?? formatEnumLabel(value);
}
