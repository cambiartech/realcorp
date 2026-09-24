import { ChannelProvider } from "@/generated/prisma";
import { ChannelConnections } from "@/components/shortlets/channel-connections";
import { ensureUnitCalendarFeeds } from "@/lib/channels/load-units";
import { unitIcalUrl } from "@/lib/channels/public-url";
import prisma from "@/lib/db";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { ChannelsWorkspace } from "./channels-workspace";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ChannelsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const ctx = await loadShortletsContext(tenantSlug);
  if (!ctx.access.canManage) notFound();

  await ensureUnitCalendarFeeds(ctx.tenant.id);

  const [leads, units, properties, pellows, feeds, imports] = await Promise.all([
    prisma.lead.findMany({
      where: {
        tenantId: ctx.tenant.id,
        shortletReservations: { none: {} },
        OR: [
          { source: { contains: "Explore", mode: "insensitive" } },
          { source: { contains: "WhatsApp", mode: "insensitive" } },
          { source: { contains: "Facebook", mode: "insensitive" } },
          { notes: { contains: "short", mode: "insensitive" } },
          { notes: { contains: "stay", mode: "insensitive" } },
          { notes: { contains: "book", mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.shortletUnit.findMany({
      where: { tenantId: ctx.tenant.id },
      select: { id: true, name: true, property: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.shortletProperty.findMany({
      where: { tenantId: ctx.tenant.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.channelConnection.findUnique({
      where: { tenantId_provider: { tenantId: ctx.tenant.id, provider: ChannelProvider.PELLOWS } },
      select: { status: true, tokenPrefix: true, lastUsedAt: true },
    }),
    prisma.channelCalendarFeed.findMany({
      where: { tenantId: ctx.tenant.id, unit: { isActive: true } },
      select: { unitId: true, feedToken: true, unit: { select: { name: true } } },
      orderBy: { unit: { name: "asc" } },
    }),
    prisma.channelCalendarImport.findMany({
      where: { tenantId: ctx.tenant.id },
      select: {
        id: true,
        provider: true,
        icalUrl: true,
        lastSyncedAt: true,
        lastError: true,
        unit: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const providerLabel: Record<string, string> = {
    AIRBNB: "Airbnb",
    BOOKING_COM: "Booking.com",
    ICAL: "Other calendar",
    PELLOWS: "Pellows",
  };

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(d);

  return (
    <div className="space-y-8">
    <ChannelConnections
      tenantSlug={ctx.tenant.slug}
      tenantId={ctx.tenant.id}
      pellowsStatus={pellows?.status === "ACTIVE" ? "ACTIVE" : pellows?.status === "REVOKED" ? "REVOKED" : "OFF"}
      tokenPrefix={pellows?.status === "ACTIVE" ? pellows.tokenPrefix : null}
      lastUsedLabel={pellows?.lastUsedAt ? fmt(pellows.lastUsedAt) : null}
      feeds={feeds.map((feed) => ({
        unitId: feed.unitId,
        unitName: feed.unit.name,
        icalUrl: unitIcalUrl(feed.feedToken),
      }))}
      imports={imports.map((row) => ({
        id: row.id,
        unitName: row.unit.name,
        providerLabel: providerLabel[row.provider] || row.provider,
        icalUrl: row.icalUrl,
        lastSyncedLabel: row.lastSyncedAt ? fmt(row.lastSyncedAt) : null,
        lastError: row.lastError,
      }))}
    />
    <ChannelsWorkspace
      tenantSlug={ctx.tenant.slug}
      defaultCheckInTime={ctx.pmsSettings.checkInTime}
      defaultCheckOutTime={ctx.pmsSettings.checkOutTime}
      leads={leads.map((l) => ({
        id: l.id,
        name: l.name || "Unknown guest",
        email: l.email || "",
        phone: l.phone || "",
        source: l.source || "Channel",
        projectInterest: l.projectInterest || "",
        notes: l.notes || "",
        createdAtLabel: fmt(l.createdAt),
      }))}
      unitOptions={units.map((u) => ({
        id: u.id,
        label: u.property ? `${u.property.name} · ${u.name}` : u.name,
      }))}
      propertyOptions={properties.map((p) => ({ id: p.id, label: p.name }))}
    />
    </div>
  );
}
