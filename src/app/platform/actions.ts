"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updateTenantShortLetsAddon(tenantId: string, enabled: boolean) {
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) {
    return { ok: false, error: "Only platform admins can update add-ons." };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, settings: { select: { id: true } } },
  });
  if (!tenant) return { ok: false, error: "Tenant not found." };

  if (tenant.settings) {
    await prisma.tenantSettings.update({
      where: { tenantId: tenant.id },
      data: { moduleShortLets: enabled },
    });
  } else {
    await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        moduleShortLets: enabled,
      },
    });
  }

  revalidatePath("/platform");
  revalidatePath(`/${tenant.slug}/settings`);
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}

export async function updateTenantModulesFromPlatform(tenantId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) {
    return { ok: false, error: "Only platform admins can update tenant modules." };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, settings: { select: { id: true } } },
  });
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const moduleSales = formData.get("moduleSales") === "on";
  const moduleFinance = formData.get("moduleFinance") === "on";
  const moduleMarketing = formData.get("moduleMarketing") === "on";
  const moduleCommunity = formData.get("moduleCommunity") === "on";
  const moduleRealtorPortal = formData.get("moduleRealtorPortal") === "on";
  const moduleShortLets = formData.get("moduleShortLets") === "on";

  if (tenant.settings) {
    await prisma.tenantSettings.update({
      where: { tenantId: tenant.id },
      data: {
        moduleSales,
        moduleFinance,
        moduleMarketing,
        moduleCommunity,
        moduleRealtorPortal,
        moduleShortLets,
      },
    });
  } else {
    await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        moduleSales,
        moduleFinance,
        moduleMarketing,
        moduleCommunity,
        moduleRealtorPortal,
        moduleShortLets,
      },
    });
  }

  revalidatePath("/platform");
  revalidatePath(`/${tenant.slug}`);
  revalidatePath(`/${tenant.slug}/settings`);
  return { ok: true };
}
