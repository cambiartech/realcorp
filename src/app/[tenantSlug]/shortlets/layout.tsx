import { ShortletsSubnav } from "@/components/shortlets/shortlets-subnav";
import { loadShortletsContext } from "@/lib/shortlets-loaders";

export default async function ShortletsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const ctx = await loadShortletsContext(tenantSlug);

  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Short Lets</h1>
        <p className="mt-1 text-sm text-muted">
          Hospitality operations — bookings, guests, housekeeping, and folio.
        </p>
      </div>
      <div className="mt-6">
        <ShortletsSubnav
          tenantSlug={ctx.tenant.slug}
          canManage={ctx.access.canManage}
          canHousekeeping={ctx.access.canHousekeeping}
          canPostFolio={ctx.access.canPostFolio}
          canSettings={ctx.access.canSettings}
          canReports={ctx.access.canReports}
        />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
