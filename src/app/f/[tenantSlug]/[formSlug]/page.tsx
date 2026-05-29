import { loadPublicCaptureForm } from "@/lib/load-public-capture-form";
import { notFound } from "next/navigation";
import { PublicCaptureFormClient } from "./public-capture-form";

export const dynamic = "force-dynamic";

export default async function PublicCaptureFormPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; formSlug: string }>;
}) {
  const { tenantSlug, formSlug } = await params;
  const loaded = await loadPublicCaptureForm(tenantSlug, formSlug);
  if (!loaded) notFound();

  return (
    <div className="min-h-dvh bg-gradient-to-b from-stone-100 to-stone-200 px-4 py-10 dark:from-stone-900 dark:to-stone-950">
      <PublicCaptureFormClient {...loaded} />
    </div>
  );
}
