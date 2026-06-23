import prisma from "@/lib/db";
import { formatEnumLabel } from "@/lib/ui-format";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { SettingsWorkspace } from "./settings-workspace";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type SettingsTab = "operations" | "catalog";

function parseSettingsTab(value?: string): SettingsTab {
  if (value === "catalog") return "catalog";
  if (value === "inventory") return "operations";
  return "operations";
}

export default async function ShortletSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { tenantSlug } = await params;
  const sp = searchParams ? await searchParams : {};
  const tab = parseSettingsTab(sp.tab);
  const ctx = await loadShortletsContext(tenantSlug);
  if (!ctx.access.canSettings) notFound();

  const serviceItems = await prisma.shortletServiceItem.findMany({
    where: { tenantId: ctx.tenant.id },
    orderBy: [{ department: "asc" }, { name: "asc" }],
  });

  return (
    <SettingsWorkspace
      tab={tab}
      tenantSlug={ctx.tenant.slug}
      defaultCurrency={ctx.tenant.defaultCurrency}
      currencies={ctx.currencies}
      pmsSettings={ctx.pmsSettings}
      moduleFinance={ctx.tenant.settings?.moduleFinance ?? false}
      serviceItems={serviceItems.map((s) => ({
        id: s.id,
        department: formatEnumLabel(s.department),
        departmentValue: s.department as "FNB" | "LAUNDRY" | "LOUNGE" | "GYM" | "OTHER",
        name: s.name,
        price: Number(s.price),
        priceLabel: `${s.currency} ${Number(s.price).toLocaleString()}`,
        currency: s.currency,
        active: s.active,
      }))}
    />
  );
}
