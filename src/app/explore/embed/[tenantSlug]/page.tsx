import { loadPublicListingBrand, loadPublicListings } from "@/lib/public-listings";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExploreWorkspace } from "../../[tenantSlug]/explore-workspace";

export const dynamic = "force-dynamic";

/** Iframe-friendly variant: no page chrome, compact grid. */
export default async function ExploreEmbedPage({
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
      <ExploreWorkspace tenantSlug={tenantSlug} brand={brand} listings={result.listings} embed />
    </Suspense>
  );
}
