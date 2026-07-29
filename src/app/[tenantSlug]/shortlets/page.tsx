import { redirect } from "next/navigation";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { defaultShortletsLanding } from "@/lib/shortlets-access";

export default async function ShortLetsIndexPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const ctx = await loadShortletsContext(tenantSlug);
  const landing = defaultShortletsLanding(ctx.membership?.role);
  redirect(`/${tenantSlug}/shortlets/${landing}`);
}
