import prisma from "@/lib/db";
import { BLOCKING_SHORTLET_STATUSES } from "@/lib/shortlets-reservation-status";
import {
  bedroomsFromLayout,
  blockSummary,
  countryCode,
  futureBlocks,
  mergeBlocks,
  nightlyMinor,
  outOfOrderBlock,
  stayToBlock,
  todayInZone,
  utcDate,
  type CalendarBlock,
} from "@/lib/channels/calendar";
import { buildIcalCalendar } from "@/lib/channels/ical";
import { unitIcalUrl } from "@/lib/channels/public-url";
import { generateFeedToken } from "@/lib/channels/tokens";

export type ChannelUnitPayload = {
  id: string;
  title: string;
  description?: string;
  city: string;
  country: string;
  neighbourhood?: string;
  currency: string;
  nightlyMinor: number;
  nightlyPrice: number;
  bedrooms?: number;
  maxGuests: number;
  amenities: string[];
  photoUrls: string[];
  icalUrl: string;
  blocks: CalendarBlock[];
  archived?: true;
};

type LoadChannelUnitsOptions = {
  updatedSince?: Date | null;
  unitId?: string;
};

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function httpsUrls(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const value of values) {
    if (!value) continue;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      continue;
    }
    if (url.protocol !== "https:") continue;
    if (seen.has(url.toString())) continue;
    seen.add(url.toString());
    urls.push(url.toString());
  }
  return urls;
}

export async function ensureUnitCalendarFeeds(tenantId: string, unitId?: string): Promise<void> {
  const units = await prisma.shortletUnit.findMany({
    where: {
      tenantId,
      OR: [{ isActive: true }, ...(unitId ? [{ id: unitId }] : [])],
    },
    select: { id: true, calendarFeed: { select: { id: true } } },
  });
  const missing = units.filter((unit) => !unit.calendarFeed);
  if (missing.length === 0) return;
  await prisma.channelCalendarFeed.createMany({
    data: missing.map((unit) => ({
      tenantId,
      unitId: unit.id,
      feedToken: generateFeedToken(),
    })),
    skipDuplicates: true,
  });
}

export async function loadChannelUnits(
  tenantId: string,
  timeZone = "Africa/Lagos",
  options: LoadChannelUnitsOptions = {},
): Promise<ChannelUnitPayload[]> {
  await ensureUnitCalendarFeeds(tenantId, options.unitId);
  const today = todayInZone(timeZone);
  const since = options.updatedSince ?? null;
  const units = await prisma.shortletUnit.findMany({
    where: {
      tenantId,
      ...(options.unitId ? { id: options.unitId } : {}),
      ...(!since && !options.unitId ? { isActive: true, listingStatus: "AVAILABLE" } : {}),
      ...(since
        ? {
            OR: [
              { updatedAt: { gt: since } },
              { reservations: { some: { updatedAt: { gt: since } } } },
              { externalBlocks: { some: { updatedAt: { gt: since } } } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    include: {
      property: { select: { name: true, city: true, state: true, country: true } },
      calendarFeed: { select: { feedToken: true } },
      projectUnit: {
        select: {
          project: { select: { coverImageUrl: true, galleryUrls: true, amenities: true, locationCity: true } },
        },
      },
      reservations: {
        where: {
          status: { in: BLOCKING_SHORTLET_STATUSES },
          checkOut: { gt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        },
        select: { id: true, guestName: true, source: true, checkIn: true, checkOut: true },
      },
      externalBlocks: {
        where: { endDate: { gt: utcDate(today) } },
        select: { externalUid: true, provider: true, startDate: true, endDate: true, summary: true },
      },
    },
  });

  return units.map((unit) => {
    const reservationBlocks = unit.reservations.map((reservation) => ({
      ...stayToBlock(reservation.checkIn, reservation.checkOut, timeZone),
      summary: blockSummary(reservation.source, reservation.guestName),
    }));
    const imported = unit.externalBlocks.map((block) => ({
      start: block.startDate.toISOString().slice(0, 10),
      end: block.endDate.toISOString().slice(0, 10),
      summary: block.summary || blockSummary(block.provider, null),
    }));
    const blocks = futureBlocks(
      mergeBlocks([
        ...reservationBlocks,
        ...imported,
        ...(unit.housekeepingStatus === "OUT_OF_ORDER" ? [outOfOrderBlock(timeZone)] : []),
      ]),
      today,
    );
    const gallery = asStringList(unit.projectUnit?.project?.galleryUrls);
    const amenities = [
      ...asStringList(unit.amenities),
      ...asStringList(unit.projectUnit?.project?.amenities),
    ].map((item) => item.toLowerCase());
    const neighbourhood = unit.location || unit.property?.name || unit.property?.city || undefined;
    const archived = !unit.isActive || unit.listingStatus !== "AVAILABLE";
    const nightlyPrice = Number(unit.nightlyRate);
    const bedrooms = bedroomsFromLayout(unit.roomLayout);
    const description = (unit.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return {
      id: unit.id,
      title: unit.name,
      ...(description ? { description } : {}),
      city: unit.property?.city || unit.projectUnit?.project?.locationCity || "Lagos",
      country: countryCode(unit.property?.country),
      ...(neighbourhood ? { neighbourhood } : {}),
      currency: (unit.currency || "NGN").toUpperCase(),
      nightlyMinor: nightlyMinor(nightlyPrice),
      nightlyPrice,
      ...(bedrooms != null ? { bedrooms } : {}),
      maxGuests: unit.maxOccupancy && unit.maxOccupancy > 0 ? unit.maxOccupancy : 2,
      amenities: [...new Set(amenities)],
      photoUrls: httpsUrls([unit.projectUnit?.project?.coverImageUrl, ...gallery]),
      icalUrl: unit.calendarFeed ? unitIcalUrl(unit.calendarFeed.feedToken) : "",
      blocks,
      ...(archived ? { archived: true as const } : {}),
    };
  });
}

export async function loadFeedCalendar(feedToken: string): Promise<string | null> {
  const feed = await prisma.channelCalendarFeed.findUnique({
    where: { feedToken },
    select: {
      unit: { select: { id: true, name: true, tenantId: true } },
      tenant: { select: { defaultTimezone: true } },
    },
  });
  if (!feed) return null;
  const units = await loadChannelUnits(feed.unit.tenantId, feed.tenant.defaultTimezone || "Africa/Lagos");
  const unit = units.find((row) => row.id === feed.unit.id);
  const events = (unit?.blocks || []).map((block, index) => ({
    uid: `${feed.unit.id}-${block.start}-${index}@realcorp`,
    start: block.start,
    end: block.end,
    summary: block.summary,
  }));
  return buildIcalCalendar({ calendarName: feed.unit.name, events });
}
