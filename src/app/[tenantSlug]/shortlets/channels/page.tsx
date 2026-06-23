import prisma from "@/lib/db";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { ChannelsWorkspace } from "./channels-workspace";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ChannelsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const ctx = await loadShortletsContext(tenantSlug);
  if (!ctx.access.canManage) notFound();

  const [leads, units, properties] = await Promise.all([
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
  ]);

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(d);

  return (
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
  );
}
