import { addDays, type CalendarBlock } from "@/lib/channels/calendar";

export type IcalEvent = CalendarBlock & { uid: string };

function unfold(source: string): string[] {
  const text = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");
  return text.split("\n");
}

function dateFromIcal(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  const date = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!date) return null;
  return `${date[1]}-${date[2]}-${date[3]}`;
}

function prop(lines: string[], name: string): string | undefined {
  const prefix = `${name}`;
  const line = lines.find((row) => row === prefix || row.startsWith(`${prefix};`) || row.startsWith(`${prefix}:`));
  if (!line) return undefined;
  const split = line.indexOf(":");
  if (split < 0) return undefined;
  return line.slice(split + 1).trim();
}

export function parseIcalEvents(source: string): IcalEvent[] {
  const lines = unfold(source);
  const events: IcalEvent[] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = [];
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) {
        const event = eventFromLines(current);
        if (event) events.push(event);
      }
      current = null;
      continue;
    }
    if (current) current.push(line);
  }
  return events;
}

function eventFromLines(lines: string[]): IcalEvent | null {
  const status = (prop(lines, "STATUS") || "").toUpperCase();
  if (status === "CANCELLED") return null;
  const start = dateFromIcal(prop(lines, "DTSTART"));
  if (!start) return null;
  let end = dateFromIcal(prop(lines, "DTEND"));
  if (!end || end <= start) end = addDays(start, 1);
  const summary = (prop(lines, "SUMMARY") || "").replace(/\\n/g, " ").replace(/\\,/g, ",").slice(0, 180);
  const uid = (prop(lines, "UID") || `${start}:${end}:${summary}`).slice(0, 240);
  return { uid, start, end, summary: summary || undefined };
}

function icsDate(iso: string): string {
  return iso.replace(/-/g, "");
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildIcalCalendar(input: {
  calendarName: string;
  events: Array<IcalEvent>;
  now?: Date;
}): string {
  const stamp = (input.now || new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const events = input.events
    .map((event) =>
      [
        "BEGIN:VEVENT",
        `UID:${escapeText(event.uid)}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(event.start)}`,
        `DTEND;VALUE=DATE:${icsDate(event.end)}`,
        `SUMMARY:${escapeText(event.summary || "Busy")}`,
        "END:VEVENT",
      ].join("\r\n"),
    )
    .join("\r\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Realcorp//Short Lets//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(input.calendarName)}`,
    events,
    "END:VCALENDAR",
    "",
  ]
    .filter((line) => line !== "")
    .join("\r\n");
}
