import { loadPublicCaptureForm } from "@/lib/load-public-capture-form";
import { notFound } from "next/navigation";
import { PublicCaptureFormClient } from "@/app/f/[tenantSlug]/[formSlug]/public-capture-form";

export const dynamic = "force-dynamic";

/** Minimal chrome for iframe embeds on websites / landing pages. */
export default async function EmbedCaptureFormPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; formSlug: string }>;
}) {
  const { tenantSlug, formSlug } = await params;
  const loaded = await loadPublicCaptureForm(tenantSlug, formSlug);
  if (!loaded) notFound();

  return (
    <div className="min-h-dvh bg-transparent p-3 sm:p-4">
      <PublicCaptureFormClient {...loaded} embed />
    </div>
  );
}
