import Link from "next/link";
import prisma from "@/lib/db";
import { normalizeTenantModuleFlags, tenantModuleSummary } from "@/lib/tenant-module-definitions";
import { PlatformModulesForm } from "./modules-form";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Platform · Realcorp",
};

export default async function PlatformHomePage() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      settings: true,
      invitations: {
        where: { acceptedAt: null },
        select: { id: true, expiresAt: true },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-foreground">Tenants</h1>
      <p className="mt-1 text-sm text-muted">
        Provisioned organizations. Tenant users sign in and work under{" "}
        <code className="border border-foreground/10 bg-field px-1.5 py-0.5 font-mono text-xs text-foreground">
          /your-tenant-slug/…
        </code>{" "}
        routes.
      </p>

      <Link
        href="/platform/onboarding"
        className="mt-6 inline-flex border border-foreground bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
      >
        Onboard new organization
      </Link>

      <p className="mt-4 text-sm text-muted">
        Debug a production crash?{" "}
        <Link href="/platform/errors" className="font-semibold text-foreground underline underline-offset-2">
          Error lookup →
        </Link>
      </p>

      <div className="mt-10 overflow-hidden border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Modules</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Invites</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted">
                  No tenants yet. Use <strong className="text-foreground/90">Onboard new organization</strong>
                  .
                </td>
              </tr>
            ) : (
              tenants.map((t) => {
                const now = new Date();
                const pendingValid = t.invitations.filter((i) => i.expiresAt > now).length;
                const pendingExpired = t.invitations.length - pendingValid;
                return (
                  <tr
                    key={t.id}
                    className="border-b border-foreground/5 transition-colors hover:bg-foreground/[0.02]"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground/90">
                      <Link
                        href={`/${t.slug}`}
                        className="underline decoration-foreground/20 underline-offset-2"
                      >
                        {t.slug}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{t.status}</td>
                    <td className="px-4 py-3 text-muted">{t.plan}</td>
                    <td className="px-4 py-3 text-muted">
                      <PlatformModulesForm
                        tenantId={t.id}
                        tenantName={t.name}
                        tenantSlug={t.slug}
                        summary={tenantModuleSummary(t.settings)}
                        initial={normalizeTenantModuleFlags(t.settings)}
                      />
                    </td>
                    <td className="px-4 py-3 text-muted">{t.createdAt.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/platform/tenants/${t.slug}`}
                        className="text-xs font-semibold text-foreground underline underline-offset-2"
                      >
                        {t.invitations.length === 0
                          ? "Send invite"
                          : pendingExpired > 0 && pendingValid === 0
                            ? "Expired — fix"
                            : `${pendingValid} pending`}
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
