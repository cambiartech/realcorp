/** One busy range. `end` is exclusive, same as iCal DTEND. */
export type CalendarBlock = {
  start: string;
  end: string;
  summary?: string;
};

export function calendarDate(value: Date, timeZone = "Africa/Lagos"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) return value.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function todayInZone(timeZone = "Africa/Lagos", now = new Date()): string {
  return calendarDate(now, timeZone);
}

/** Stay dates as an exclusive-end block. A same-calendar-day stay still blocks one night. */
export function stayToBlock(checkIn: Date, checkOut: Date, timeZone = "Africa/Lagos"): CalendarBlock {
  const start = calendarDate(checkIn, timeZone);
  let end = calendarDate(checkOut, timeZone);
  if (end <= start) end = addDays(start, 1);
  return { start, end };
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function mergeBlocks(blocks: CalendarBlock[]): CalendarBlock[] {
  const sorted = blocks
    .filter((block) => block.start && block.end && block.start < block.end)
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const merged: CalendarBlock[] = [];
  for (const block of sorted) {
    const last = merged[merged.length - 1];
    if (last && block.start <= last.end) {
      if (block.end > last.end) last.end = block.end;
      continue;
    }
    merged.push({ start: block.start, end: block.end, summary: block.summary });
  }
  return merged;
}

export function nightlyMinor(major: number): number {
  if (!Number.isFinite(major) || major < 0) return 0;
  return Math.round(major * 100);
}

export function countryCode(value: string | null | undefined): string {
  const text = (value || "").trim().toLowerCase();
  if (!text || text === "nigeria" || text === "ng" || text === "nga") return "NG";
  if (/^[a-z]{2}$/i.test(text)) return text.toUpperCase();
  return "NG";
}

export function bedroomsFromLayout(layout: string | null | undefined): number | undefined {
  if (!layout) return undefined;
  const match = layout.match(/(\d+)\s*(?:bed|br|bedroom)/i) || layout.match(/^(\d+)\b/);
  if (!match) return undefined;
  const count = Number(match[1]);
  return Number.isInteger(count) && count > 0 && count < 30 ? count : undefined;
}

export function bathroomsFromLayout(layout: string | null | undefined): number | undefined {
  if (!layout) return undefined;
  const match = layout.match(/(\d+(?:\.\d+)?)\s*(?:bath|bathroom)/i);
  if (!match) return undefined;
  const count = Number(match[1]);
  return Number.isFinite(count) && count > 0 && count < 30 ? count : undefined;
}

const SOURCE_LABEL: Record<string, string> = {
  DIRECT: "Direct",
  WALK_IN: "Walk-in",
  EXPLORE: "Explore",
  PHONE: "Phone",
  OTA: "OTA",
  PELLOWS: "Pellows",
  AIRBNB: "Airbnb",
  BOOKING_COM: "Booking.com",
  ICAL: "Calendar",
};

export function channelSourceLabel(source: string | null | undefined): string {
  if (!source) return "Direct";
  return SOURCE_LABEL[source] || source;
}

export function blockSummary(source: string | null | undefined, guestName: string | null | undefined): string {
  const who = (guestName || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const label = channelSourceLabel(source);
  return who ? `${label} · ${who}` : label;
}

export function outOfOrderBlock(timeZone = "Africa/Lagos", now = new Date()): CalendarBlock {
  const start = todayInZone(timeZone, now);
  return { start, end: addDays(start, 540), summary: "Out of order" };
}

export function dateOnlyUtc(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function utcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function futureBlocks(blocks: CalendarBlock[], today: string): CalendarBlock[] {
  return blocks.filter((block) => block.end > today);
}

export const CHANNEL_PULL_LIMIT_PER_HOUR = 60;
export const CHANNEL_PULL_WINDOW_MS = 60 * 60 * 1000;
