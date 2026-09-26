import { ChannelProvider } from "@/generated/prisma";
import prisma from "@/lib/db";
import { openToken, sealToken } from "@/lib/channels/airbnb/crypto";
import { fetchAirbnbBusy, fetchAirbnbListings, refreshAirbnbToken } from "@/lib/channels/airbnb/client";
import { ensureUnitCalendarFeeds } from "@/lib/channels/load-units";
import { notifyPellowsUnit } from "@/lib/channels/pellows-notify";
import { utcDate } from "@/lib/channels/calendar";

async function accessTokenFor(tenantId: string) {
  const link = await prisma.airbnbHostLink.findUnique({ where: { tenantId } });
  if (!link || link.status !== "ACTIVE") return null;
  let access = openToken(link.accessTokenCipher);
  const refresh = link.refreshTokenCipher ? openToken(link.refreshTokenCipher) : "";
  const due = link.expiresAt && link.expiresAt.getTime() < Date.now() + 5 * 60 * 1000;
  if (due && refresh) {
    const next = await refreshAirbnbToken(refresh);
    access = next.accessToken || access;
    await prisma.airbnbHostLink.update({
      where: { id: link.id },
      data: {
        accessTokenCipher: sealToken(access),
        ...(next.refreshToken ? { refreshTokenCipher: sealToken(next.refreshToken) } : {}),
        ...(next.expiresAt ? { expiresAt: next.expiresAt } : {}),
        ...(next.userId ? { airbnbUserId: next.userId } : {}),
      },
    });
  }
  return { access, userId: link.airbnbUserId };
}

export async function syncAirbnbTenant(tenantId: string): Promise<{ ok: true; listings: number } | { ok: false; error: string }> {
  const auth = await accessTokenFor(tenantId).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Could not refresh Airbnb.";
    return { error: message } as const;
  });
  if (!auth) return { ok: false, error: "Airbnb is not connected." };
  if ("error" in auth) {
    await prisma.airbnbHostLink.update({
      where: { tenantId },
      data: { lastError: auth.error.slice(0, 300) },
    });
    return { ok: false, error: auth.error };
  }

  try {
    const listings = await fetchAirbnbListings(auth.access, auth.userId);
    for (const listing of listings) {
      const propertyName = listing.city || "Airbnb";
      let property = await prisma.shortletProperty.findFirst({
        where: { tenantId, name: propertyName },
        select: { id: true },
      });
      if (!property) {
        property = await prisma.shortletProperty.create({
          data: {
            tenantId,
            name: propertyName,
            address: listing.address,
            city: listing.city,
            country: listing.country || "Nigeria",
          },
          select: { id: true },
        });
      }
      const layout = [
        listing.bedrooms ? `${listing.bedrooms} bed` : "",
        listing.bathrooms ? `${listing.bathrooms} bath` : "",
      ]
        .filter(Boolean)
        .join(" ");
      const nightlyRate = listing.nightlyPrice && listing.nightlyPrice > 0 ? listing.nightlyPrice : null;
      const data = {
        name: listing.name,
        location: listing.neighbourhood || listing.city || null,
        description: listing.description || null,
        roomLayout: layout || null,
        maxOccupancy: listing.maxGuests ? Math.round(listing.maxGuests) : null,
        amenities: listing.amenities,
        photoUrls: listing.photoUrls,
        currency: listing.currency || "NGN",
        isActive: listing.active,
        listingStatus: listing.active ? ("AVAILABLE" as const) : ("UNAVAILABLE" as const),
        propertyId: property.id,
        ...(nightlyRate != null ? { nightlyRate } : {}),
      };
      const existing = await prisma.shortletUnit.findFirst({
        where: { tenantId, airbnbListingId: listing.id },
        select: { id: true },
      });
      const unit = existing
        ? await prisma.shortletUnit.update({
            where: { id: existing.id },
            data,
          })
        : await prisma.shortletUnit.create({
            data: {
              tenantId,
              airbnbListingId: listing.id,
              nightlyRate: nightlyRate ?? 0,
              ...data,
            },
          });
      const busy = await fetchAirbnbBusy(auth.access, listing.id);
      await prisma.channelExternalBlock.deleteMany({
        where: { unitId: unit.id, provider: ChannelProvider.AIRBNB },
      });
      if (busy.length) {
        await prisma.channelExternalBlock.createMany({
          data: busy.map((range) => ({
            tenantId,
            unitId: unit.id,
            provider: ChannelProvider.AIRBNB,
            externalUid: range.uid.slice(0, 180),
            startDate: utcDate(range.start),
            endDate: utcDate(range.end),
            summary: range.summary || "Airbnb",
          })),
          skipDuplicates: true,
        });
      }
      await notifyPellowsUnit({
        tenantId,
        unitId: unit.id,
        event: listing.active ? "unit.upserted" : "unit.archived",
      });
    }
    await ensureUnitCalendarFeeds(tenantId);
    await prisma.airbnbHostLink.update({
      where: { tenantId },
      data: { lastSyncedAt: new Date(), lastError: null },
    });
    return { ok: true, listings: listings.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Airbnb sync failed.";
    await prisma.airbnbHostLink.update({
      where: { tenantId },
      data: { lastError: message.slice(0, 300) },
    });
    return { ok: false, error: message };
  }
}

export async function syncAllAirbnbLinks(): Promise<{ synced: number; failed: number }> {
  const links = await prisma.airbnbHostLink.findMany({
    where: { status: "ACTIVE" },
    select: { tenantId: true },
  });
  let synced = 0;
  let failed = 0;
  for (const link of links) {
    const result = await syncAirbnbTenant(link.tenantId);
    if (result.ok) synced += 1;
    else failed += 1;
  }
  return { synced, failed };
}
