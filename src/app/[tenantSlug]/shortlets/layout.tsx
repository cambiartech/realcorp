import { ShortletsSubnav } from "@/components/shortlets/shortlets-subnav";
import { TenantPageShell } from "@/components/tenant-page-shell";
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
    <TenantPageShell>
      <header className="rc-page-header">
        <div className="min-w-0">
          <p className="rc-page-eyebrow">Hospitality</p>
          <h1 className="rc-page-title">Short Lets</h1>
          <p className="rc-page-desc">
            Bookings, guests, housekeeping, and guest bill — ready for the front desk.
          </p>
        </div>
      </header>
      <ShortletsSubnav
        tenantSlug={ctx.tenant.slug}
        canManage={ctx.access.canManage}
        canHousekeeping={ctx.access.canHousekeeping}
        canPostFolio={ctx.access.canPostFolio}
        canSettings={ctx.access.canSettings}
        canReports={ctx.access.canReports}
      />
      <div>{children}</div>
    </TenantPageShell>
  );
}
