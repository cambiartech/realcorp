import { loadPublicListingBrand, loadPublicListings } from "@/lib/public-listings";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExploreWorkspace } from "./explore-workspace";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const brand = await loadPublicListingBrand(tenantSlug);
  return {
    title: brand ? `Explore listings · ${brand.tenantName}` : "Explore listings",
    description: brand
      ? `Browse available projects and listings from ${brand.tenantName}.`
      : "Browse available projects and listings.",
  };
}

export default async function ExplorePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const [brand, result] = await Promise.all([
    loadPublicListingBrand(tenantSlug),
    loadPublicListings(tenantSlug, { limit: 50 }),
  ]);
  if (!brand || !result) notFound();

  return (
    <Suspense>
      <ExploreWorkspace tenantSlug={tenantSlug} brand={brand} listings={result.listings} />
    </Suspense>
  );
}
