import { ChannelProvider } from "@/generated/prisma";
import prisma from "@/lib/db";
import { parseIcalEvents } from "@/lib/channels/ical";
import { todayInZone, utcDate } from "@/lib/channels/calendar";
import { publicHttpsUrl } from "@/lib/channels/public-url";

const MAX_BYTES = 1_000_000;

export async function syncCalendarImport(importId: string): Promise<{ ok: true; blocks: number } | { ok: false; error: string }> {
  const row = await prisma.channelCalendarImport.findUnique({
    where: { id: importId },
    select: { id: true, tenantId: true, unitId: true, provider: true, icalUrl: true },
  });
  if (!row) return { ok: false, error: "Calendar link not found." };
  const url = publicHttpsUrl(row.icalUrl);
  if (!url) return { ok: false, error: "Calendar link must be a public https URL." };

  let text = "";
  try {
    const response = await fetch(url, {
      headers: { Accept: "text/calendar, text/plain, */*" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!response.ok) {
      const error = `Calendar returned ${response.status}.`;
      await markError(row.id, error);
      return { ok: false, error };
    }
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_BYTES) {
      const error = "Calendar file is too large.";
      await markError(row.id, error);
      return { ok: false, error };
    }
    text = (await response.text()).slice(0, MAX_BYTES);
  } catch {
    const error = "Could not reach that calendar.";
    await markError(row.id, error);
    return { ok: false, error };
  }

  const today = todayInZone("Africa/Lagos");
  const byUid = new Map<string, ReturnType<typeof parseIcalEvents>[number]>();
  for (const event of parseIcalEvents(text)) {
    if (event.end > today) byUid.set(event.uid, event);
  }
  const events = [...byUid.values()].slice(0, 500);
  await prisma.$transaction([
    prisma.channelExternalBlock.deleteMany({
      where: { unitId: row.unitId, provider: row.provider },
    }),
    ...(events.length
      ? [
          prisma.channelExternalBlock.createMany({
            data: events.map((event) => ({
              tenantId: row.tenantId,
              unitId: row.unitId,
              provider: row.provider,
              externalUid: event.uid,
              startDate: utcDate(event.start),
              endDate: utcDate(event.end),
              summary: event.summary || null,
            })),
          }),
        ]
      : []),
    prisma.channelCalendarImport.update({
      where: { id: row.id },
      data: { lastSyncedAt: new Date(), lastError: null },
    }),
  ]);
  return { ok: true, blocks: events.length };
}

async function markError(id: string, error: string) {
  await prisma.channelCalendarImport.update({
    where: { id },
    data: { lastError: error.slice(0, 300), lastSyncedAt: new Date() },
  });
}

export async function syncAllCalendarImports(): Promise<{ synced: number; failed: number }> {
  const rows = await prisma.channelCalendarImport.findMany({ select: { id: true } });
  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    const result = await syncCalendarImport(row.id);
    if (result.ok) synced += 1;
    else failed += 1;
  }
  return { synced, failed };
}

export const INBOUND_CALENDAR_PROVIDERS: ChannelProvider[] = [
  ChannelProvider.AIRBNB,
  ChannelProvider.BOOKING_COM,
  ChannelProvider.ICAL,
];
