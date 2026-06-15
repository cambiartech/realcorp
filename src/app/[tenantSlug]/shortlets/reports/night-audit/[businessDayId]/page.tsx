import prisma from "@/lib/db";
import { parseNightAuditSnapshot } from "@/lib/shortlets-night-audit";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { NightAuditReport } from "@/components/shortlets/night-audit-report";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NightAuditDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; businessDayId: string }>;
}) {
  const { tenantSlug, businessDayId } = await params;
  const ctx = await loadShortletsContext(tenantSlug);

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { name: true },
  });
  if (!tenant) notFound();

  const day = await prisma.shortletBusinessDay.findFirst({
    where: { id: businessDayId, tenantId: ctx.tenant.id },
  });
  if (!day) notFound();

  const audit = parseNightAuditSnapshot(day.snapshot);
  if (!audit) notFound();

  return (
    <NightAuditReport
      tenantName={tenant.name}
      audit={{
        ...audit,
        closedByLabel: audit.closedByLabel || day.closedByLabel || undefined,
        closedAtLabel:
          audit.closedAtLabel ||
          new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(day.closedAt),
      }}
    />
  );
}
