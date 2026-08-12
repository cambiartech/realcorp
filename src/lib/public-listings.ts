import prisma from "@/lib/db";

/**
 * Shared query layer for the public listings surface (Explore page, embeddable
 * widget, public JSON API, and — later — the WhatsApp bot).
 * Only published projects are ever returned.
 */

export type PublicListing = {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  address: string | null;
  coverImageUrl: string | null;
  galleryUrls: string[];
  amenities: string[];
  currency: string;
  priceFrom: number | null;
  priceTo: number | null;
  unitsAvailable: number;
  unitsTotal: number;
  purposes: string[]; // SALE | SHORT_LET | RENTAL | HOSTEL
  publishedAt: string | null;
};

export type PublicListingFilters = {
  q?: string;
  city?: string;
  purpose?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  offset?: number;
};

export type PublicListingBrand = {
  tenantName: string;
  logoUrl: string | null;
  accentColor: string | null;
};

function jsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

export async function loadPublicListingBrand(tenantSlug: string): Promise<PublicListingBrand | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      name: true,
      settings: { select: { logoUrl: true, accentColor: true, primaryColor: true, moduleListings: true } },
    },
  });
  // Listings module is a platform-controlled add-on; behave as not-found when off.
  if (!tenant || tenant.settings?.moduleListings === false) return null;
  return {
    tenantName: tenant.name,
    logoUrl: tenant.settings?.logoUrl ?? null,
    accentColor: tenant.settings?.accentColor ?? tenant.settings?.primaryColor ?? null,
  };
}

export async function loadPublicListings(
  tenantSlug: string,
  filters: PublicListingFilters = {},
): Promise<{ listings: PublicListing[]; total: number } | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, settings: { select: { moduleListings: true } } },
  });
  if (!tenant || tenant.settings?.moduleListings === false) return null;

  const limit = Math.min(Math.max(filters.limit ?? 24, 1), 50);
  const offset = Math.max(filters.offset ?? 0, 0);

  const where = {
    tenantId: tenant.id,
    isPublished: true,
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" as const } },
            { listingDescription: { contains: filters.q, mode: "insensitive" as const } },
            { locationCity: { contains: filters.q, mode: "insensitive" as const } },
            { locationState: { contains: filters.q, mode: "insensitive" as const } },
            { locationCountry: { contains: filters.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(filters.city ? { locationCity: { equals: filters.city, mode: "insensitive" as const } } : {}),
  };

  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      select: {
        id: true,
        name: true,
        listingDescription: true,
        locationCity: true,
        locationState: true,
        locationCountry: true,
        locationAddress: true,
        coverImageUrl: true,
        galleryUrls: true,
        amenities: true,
        currency: true,
        basePrice: true,
        publishedAt: true,
        pricingPlans: { select: { price: true } },
        units: { select: { status: true, purpose: true } },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: offset,
      take: limit,
    }),
  ]);

  let listings: PublicListing[] = projects.map((p) => {
    const planPrices = p.pricingPlans
      .map((plan) => Number(plan.price))
      .filter((n) => Number.isFinite(n) && n > 0);
    const base = p.basePrice != null ? Number(p.basePrice) : null;
    const allPrices = [...planPrices, ...(base != null && base > 0 ? [base] : [])];
    const unitsAvailable = p.units.filter((u) => u.status === "AVAILABLE").length;
    const purposes = Array.from(new Set(p.units.map((u) => u.purpose)));

    return {
      id: p.id,
      name: p.name,
      description: p.listingDescription,
      city: p.locationCity,
      state: p.locationState,
      country: p.locationCountry,
      address: p.locationAddress,
      coverImageUrl: p.coverImageUrl,
      galleryUrls: jsonStringArray(p.galleryUrls),
      amenities: jsonStringArray(p.amenities),
      currency: p.currency,
      priceFrom: allPrices.length ? Math.min(...allPrices) : null,
      priceTo: allPrices.length ? Math.max(...allPrices) : null,
      unitsAvailable,
      unitsTotal: p.units.length,
      purposes,
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    };
  });

  // Purpose + price filters operate on derived values, so apply after mapping.
  if (filters.purpose) {
    const purpose = filters.purpose.toUpperCase();
    listings = listings.filter((l) => l.purposes.includes(purpose));
  }
  if (filters.minPrice != null) {
    listings = listings.filter((l) => l.priceTo == null || l.priceTo >= filters.minPrice!);
  }
  if (filters.maxPrice != null) {
    listings = listings.filter((l) => l.priceFrom == null || l.priceFrom <= filters.maxPrice!);
  }

  return { listings, total };
}
