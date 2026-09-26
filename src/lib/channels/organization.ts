import prisma from "@/lib/db";
import { appOrigin, publicHttpsUrl } from "@/lib/channels/public-url";

/** Public organization page. No tokens, payroll, or private settings. */
export type ChannelOrganization = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  currency: string;
  timezone: string;
  listingsUrl: string | null;
};

function clean(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

export async function loadChannelOrganization(tenantId: string): Promise<ChannelOrganization | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      defaultCurrency: true,
      defaultTimezone: true,
      settings: {
        select: {
          logoUrl: true,
          orgEmail: true,
          orgPhone: true,
          orgAddressLine: true,
          orgCity: true,
          orgState: true,
          orgCountry: true,
        },
      },
    },
  });
  if (!tenant) return null;
  const settings = tenant.settings;
  const origin = appOrigin();
  const listingsUrl =
    origin && tenant.slug ? publicHttpsUrl(`${origin}/explore/${tenant.slug}`) : null;
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    logoUrl: settings?.logoUrl ? publicHttpsUrl(settings.logoUrl) : null,
    email: clean(settings?.orgEmail),
    phone: clean(settings?.orgPhone),
    addressLine: clean(settings?.orgAddressLine),
    city: clean(settings?.orgCity),
    state: clean(settings?.orgState),
    country: clean(settings?.orgCountry) || "Nigeria",
    currency: tenant.defaultCurrency || "NGN",
    timezone: tenant.defaultTimezone || "Africa/Lagos",
    listingsUrl,
  };
}
