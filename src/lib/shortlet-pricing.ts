export function resolveShortletServiceCharge(
  apartmentAmount: number | null | undefined,
  tenantDefault: number | null | undefined,
) {
  if (apartmentAmount != null && Number.isFinite(apartmentAmount)) return apartmentAmount;
  if (tenantDefault != null && Number.isFinite(tenantDefault)) return tenantDefault;
  return 0;
}

export function shortletStaySubtotal(input: {
  nightlyRate: number;
  nights: number;
  cleaningFee?: number | null;
  serviceCharge?: number | null;
}) {
  return (
    Number(input.nightlyRate || 0) * Number(input.nights || 0) +
    Number(input.cleaningFee || 0) +
    Number(input.serviceCharge || 0)
  );
}
