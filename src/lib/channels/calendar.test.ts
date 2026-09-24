import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  bedroomsFromLayout,
  blockSummary,
  countryCode,
  mergeBlocks,
  nightlyMinor,
  rangesOverlap,
  stayToBlock,
} from "./calendar";
import { parseIcalEvents, buildIcalCalendar } from "./ical";
import { publicHttpsUrl } from "./public-url";
import { parseUpdatedSince, signPellowsBody } from "./pellows-feed";

test("stay of 20–27 Dec is exclusive on the checkout date", () => {
  const block = stayToBlock(new Date("2026-12-20T14:00:00+01:00"), new Date("2026-12-27T11:00:00+01:00"));
  assert.equal(block.start, "2026-12-20");
  assert.equal(block.end, "2026-12-27");
});

test("a same-day stay still blocks one night", () => {
  const block = stayToBlock(new Date("2026-12-20T10:00:00+01:00"), new Date("2026-12-20T18:00:00+01:00"));
  assert.equal(block.start, "2026-12-20");
  assert.equal(block.end, "2026-12-21");
});

test("overlapping ranges and merged blocks", () => {
  assert.equal(rangesOverlap("2026-12-20", "2026-12-27", "2026-12-26", "2026-12-28"), true);
  assert.equal(rangesOverlap("2026-12-20", "2026-12-27", "2026-12-27", "2026-12-29"), false);
  const merged = mergeBlocks([
    { start: "2026-12-20", end: "2026-12-24", summary: "Airbnb" },
    { start: "2026-12-23", end: "2026-12-27", summary: "Direct" },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].end, "2026-12-27");
});

test("nightly rate is kobo and neighbourhood helpers stay stable", () => {
  assert.equal(nightlyMinor(150000), 15000000);
  assert.equal(countryCode("Nigeria"), "NG");
  assert.equal(bedroomsFromLayout("2 Bedroom"), 2);
  assert.equal(blockSummary("OTA", "Ada Okonkwo"), "OTA · Ada Okonkwo");
  assert.equal(addDays("2026-12-20", 7), "2026-12-27");
});

test("ical import keeps exclusive end and skips cancelled events", () => {
  const events = parseIcalEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:stay-1
DTSTART;VALUE=DATE:20261220
DTEND;VALUE=DATE:20261227
SUMMARY:Airbnb · Ada
END:VEVENT
BEGIN:VEVENT
UID:gone
DTSTART;VALUE=DATE:20261201
DTEND;VALUE=DATE:20261203
STATUS:CANCELLED
SUMMARY:Cancelled
END:VEVENT
END:VCALENDAR`);
  assert.equal(events.length, 1);
  assert.equal(events[0].start, "2026-12-20");
  assert.equal(events[0].end, "2026-12-27");
  const ics = buildIcalCalendar({ calendarName: "Room 1", events, now: new Date("2026-09-24T08:00:00Z") });
  assert.match(ics, /DTEND;VALUE=DATE:20261227/);
});

test("catch-up cursor and webhook signature", () => {
  assert.equal(parseUpdatedSince(null), null);
  assert.equal(parseUpdatedSince("not-a-date"), "invalid");
  assert.equal(parseUpdatedSince("2026-09-24T08:00:00Z") instanceof Date, true);
  const body = JSON.stringify({ eventId: "evt_01", tenantId: "ten", event: "unit.upserted", unit: {} });
  const signature = signPellowsBody(body, "secret");
  assert.match(signature, /^sha256=[0-9a-f]{64}$/);
  assert.equal(signPellowsBody(body, "secret"), signature);
});

test("calendar links must be public https", () => {
  assert.equal(publicHttpsUrl("http://example.com/cal.ics"), null);
  assert.equal(publicHttpsUrl("https://localhost/cal.ics"), null);
  assert.equal(publicHttpsUrl("https://192.168.1.4/cal.ics"), null);
  assert.ok(publicHttpsUrl("https://calendar.google.com/calendar/ical/example.ics"));
});
