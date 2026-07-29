export type ShortletPmsSettings = {
  checkInTime: string;
  checkOutTime: string;
  eodTime: string;
  checkoutAlertHours: number;
  financeSync: boolean;
};

export const DEFAULT_SHORTLET_PMS_SETTINGS: ShortletPmsSettings = {
  checkInTime: "14:00",
  checkOutTime: "12:00",
  eodTime: "23:59",
  checkoutAlertHours: 2,
  financeSync: false,
};

export function parseShortletPmsSettings(
  raw:
    | {
        shortletCheckInTime?: string | null;
        shortletCheckOutTime?: string | null;
        shortletEodTime?: string | null;
        shortletCheckoutAlertHours?: number | null;
        shortletFinanceSync?: boolean | null;
      }
    | null
    | undefined,
): ShortletPmsSettings {
  return {
    checkInTime: raw?.shortletCheckInTime?.trim() || DEFAULT_SHORTLET_PMS_SETTINGS.checkInTime,
    checkOutTime: raw?.shortletCheckOutTime?.trim() || DEFAULT_SHORTLET_PMS_SETTINGS.checkOutTime,
    eodTime: raw?.shortletEodTime?.trim() || DEFAULT_SHORTLET_PMS_SETTINGS.eodTime,
    checkoutAlertHours: raw?.shortletCheckoutAlertHours ?? DEFAULT_SHORTLET_PMS_SETTINGS.checkoutAlertHours,
    financeSync: raw?.shortletFinanceSync ?? DEFAULT_SHORTLET_PMS_SETTINGS.financeSync,
  };
}

export function combineDateAndTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00`);
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map((x) => Number(x));
  return (h || 0) * 60 + (m || 0);
}

export function isCheckoutDueSoon(
  checkOut: Date,
  checkOutTime: string,
  alertHours: number,
  now = new Date(),
): boolean {
  const due = new Date(checkOut);
  const mins = parseTimeToMinutes(checkOutTime);
  due.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  const diffMs = due.getTime() - now.getTime();
  const alertMs = alertHours * 60 * 60 * 1000;
  return diffMs >= 0 && diffMs <= alertMs;
}

export function isCheckoutOverdue(checkOut: Date, checkOutTime: string, now = new Date()): boolean {
  const due = new Date(checkOut);
  const mins = parseTimeToMinutes(checkOutTime);
  due.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return now.getTime() > due.getTime();
}
