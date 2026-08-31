import { HrPublicFormClient } from "@/components/hr/hr-public-form-client";
import { prefillValuesForForm } from "@/lib/hr-form-prefill";
import { loadHrFormRequestByToken } from "@/lib/hr-form-request-loader";
import { resolveBundleTokenForFormRequest } from "@/lib/hr-form-bundle-consolidate";
import { hrOnboardingBundlePath } from "@/lib/hr-form-types";
import { parsePensionAdministrators } from "@/lib/org-pension-administrators";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HrPublicFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const loaded = await loadHrFormRequestByToken(token);
  if (!loaded) notFound();

  const bundleToken = loaded.bundleToken ?? (await resolveBundleTokenForFormRequest(loaded));
  if (bundleToken) {
    redirect(
      hrOnboardingBundlePath(bundleToken, {
        form: loaded.formType,
        tenant: loaded.tenant.slug,
      }),
    );
  }

  const initialValues = loaded.profile
    ? prefillValuesForForm(loaded.profile)
    : {
        fullName: loaded.recipientName || "",
        workEmail: loaded.recipientEmail || "",
        phoneMobile: "",
      };

  if (!initialValues.workEmail && loaded.recipientEmail) {
    initialValues.workEmail = loaded.recipientEmail;
  }

  return (
    <HrPublicFormClient
      token={token}
      formType={loaded.formType}
      deliveryMode={loaded.deliveryMode}
      status={loaded.status}
      brand={loaded.brand}
      employeeName={loaded.profile?.fullName || loaded.recipientName || ""}
      hrNote={loaded.hrNote}
      initialValues={initialValues}
      printPath={`/hr-form/${token}/print`}
      pensionAdministrators={parsePensionAdministrators(loaded.tenant.settings?.pensionAdministrators)}
    />
  );
}
