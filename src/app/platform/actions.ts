"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { readTenantModuleFlagsFromForm } from "@/lib/tenant-module-definitions";
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

  const modules = readTenantModuleFlagsFromForm(formData);

  if (tenant.settings) {
    await prisma.tenantSettings.update({
      where: { tenantId: tenant.id },
      data: modules,
    });
  } else {
    await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        ...modules,
      },
    });
  }

  revalidatePath("/platform");
  revalidatePath(`/${tenant.slug}`);
  revalidatePath(`/${tenant.slug}/settings`);
  revalidatePath(`/${tenant.slug}/clients`);
  revalidatePath(`/${tenant.slug}/hr`);
  revalidatePath(`/${tenant.slug}/tasks`);
  return { ok: true };
}
