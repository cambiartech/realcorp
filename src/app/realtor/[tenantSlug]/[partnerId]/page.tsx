import prisma from "@/lib/db";
import { verifyPortalToken } from "@/lib/portal-token";
import { notFound } from "next/navigation";
import { PortalLeadForm } from "./portal-lead-form";

export const dynamic = "force-dynamic";

export default async function RealtorPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; partnerId: string }>;
  searchParams: Promise<{ a?: string }>;
}) {
  const { tenantSlug, partnerId } = await params;
  const { a: accessToken } = await searchParams;

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, name: true },
  });
  if (!tenant) notFound();

  const partner = await prisma.realtorPartner.findFirst({
    where: { id: partnerId, tenantId: tenant.id, isActive: true },
    select: {
      id: true,
      displayName: true,
      portalTokenHash: true,
    },
  });
  if (!partner || !verifyPortalToken(accessToken ?? null, partner.portalTokenHash)) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-12">
        <div className="rounded-2xl border border-stone-300 bg-white/90 p-8 shadow-lg dark:border-stone-700 dark:bg-stone-900/90">
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-50">Portal unavailable</h1>
          <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">
            This link is invalid, expired, or the partner account is inactive. Contact your developer representative for a
            new portal URL.
          </p>
        </div>
      </div>
    );
  }

  const [projects, recentLeads] = await Promise.all([
    prisma.project.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 100,
    }),
    prisma.lead.findMany({
      where: { tenantId: tenant.id, realtorPartnerId: partner.id },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        projectInterest: true,
        quality: true,
        createdAt: true,
        campaignName: true,
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">Community portal</p>
        <h1 className="mt-2 text-2xl font-bold text-stone-900 dark:text-stone-50">{tenant.name}</h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">Signed in as {partner.displayName}</p>
      </header>

      <section className="mt-10 rounded-2xl border border-stone-200 bg-white/95 p-6 shadow-md dark:border-stone-700 dark:bg-stone-900/95">
        <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">Submit a lead</h2>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Optional: add UTM fields to attribute to an active campaign code.
        </p>
        <PortalLeadForm
          tenantSlug={tenantSlug}
          partnerId={partnerId}
          accessToken={accessToken ?? ""}
          projectOptions={projects.map((p) => ({ id: p.id, name: p.name }))}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">Your recent submissions</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-stone-200 bg-white/90 dark:border-stone-700 dark:bg-stone-900/80">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-100/80 text-xs uppercase text-stone-500 dark:bg-stone-800 dark:text-stone-400">
              <tr>
                <th className="px-3 py-2">Lead</th>
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2">Campaign</th>
                <th className="px-3 py-2">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-700">
              {recentLeads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-stone-500">
                    No submissions yet.
                  </td>
                </tr>
              ) : (
                recentLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="px-3 py-2 font-medium text-stone-900 dark:text-stone-100">
                      {lead.name ?? "—"}
                      <div className="text-xs font-normal text-stone-500">{lead.email ?? lead.phone ?? ""}</div>
                    </td>
                    <td className="px-3 py-2 text-stone-600 dark:text-stone-300">{lead.projectInterest ?? "—"}</td>
                    <td className="px-3 py-2 text-stone-600 dark:text-stone-300">{lead.campaignName ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-stone-500">{lead.createdAt.toISOString().slice(0, 10)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
