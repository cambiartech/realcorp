"use client";

import Link from "next/link";
import { useState } from "react";
import { BiodataFormFields } from "@/components/hr/biodata-form-fields";
import { HrFormField, HrFormLockedField, HrFormSelect } from "@/components/hr/hr-form-field";
import { HrTagsInput } from "@/components/hr/hr-tags-input";
import { HrLocationFields } from "@/components/hr/hr-location-fields";
import { BrandedDocumentShell } from "@/components/hr/branded-document-shell";
import {
  getHrFormUploadSignature,
  submitHrFormOnline,
  submitHrFormUpload,
} from "@/app/hr-form/[token]/actions";
import { uploadViaCloudinarySignature } from "@/lib/cloudinary-upload-client";
import type { HrFormDeliveryMode, HrFormRequestStatus, HrFormType } from "@/generated/prisma";
import { HR_FORM_DELIVERY_LABELS, HR_FORM_TYPE_LABELS } from "@/lib/hr-form-types";
import type { TenantBranding } from "@/lib/tenant-branding";
import { brandingCssVars } from "@/lib/tenant-branding";
import { ButtonSpinner } from "@/components/button-spinner";

type InitialValues = Record<string, string>;

export function HrPublicFormClient({
  token,
  formType,
  deliveryMode,
  status,
  brand,
  employeeName,
  hrNote,
  initialValues,
  printPath,
  embedded = false,
  suppressBackNav = false,
  onboardingHref,
  dashboardHref,
  onSubmitted,
  onBackToForms,
}: {
  token: string;
  formType: HrFormType;
  deliveryMode: HrFormDeliveryMode;
  status: HrFormRequestStatus;
  brand: TenantBranding;
  employeeName: string;
  hrNote: string | null;
  initialValues: InitialValues;
  printPath: string;
  embedded?: boolean;
  /** Hide redundant back links when parent renders step nav (bundle). */
  suppressBackNav?: boolean;
  onboardingHref?: string;
  dashboardHref?: string;
  onSubmitted?: () => void;
  onBackToForms?: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(status === "SUBMITTED" || status === "APPROVED");
  const [mode, setMode] = useState<"online" | "upload">(
    deliveryMode === "PRINT_UPLOAD" ? "upload" : "online",
  );

  const canFillOnline = deliveryMode === "ONLINE_FILL" || deliveryMode === "BOTH";
  const canUpload = deliveryMode === "PRINT_UPLOAD" || deliveryMode === "BOTH";

  async function handleOnlineSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd.entries()) as Record<string, unknown>;
    const result = await submitHrFormOnline(token, raw);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
    onSubmitted?.();
  }

  async function handleUpload(file: File) {
    setPending(true);
    setError(null);
    const sig = await getHrFormUploadSignature(token, { fileName: file.name });
    if (!sig.ok) {
      setPending(false);
      setError(sig.error);
      return;
    }
    const uploaded = await uploadViaCloudinarySignature(file, {
      ...sig,
      uploadUrl: `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`,
      source: "platform",
    });
    if (!uploaded.ok) {
      setPending(false);
      setError(uploaded.error);
      return;
    }
    const submit = await submitHrFormUpload(token, { fileUrl: uploaded.secureUrl, fileName: file.name });
    setPending(false);
    if (!submit.ok) {
      setError(submit.error);
      return;
    }
    setDone(true);
    onSubmitted?.();
  }

  if (status === "EXPIRED" || status === "CANCELLED") {
    const unavailable = (
      <p className="text-sm text-slate-600">
        This link is no longer active. Contact your HR team for a new link.
      </p>
    );
    if (embedded) return <div className="rounded-xl border border-slate-200 bg-white p-4">{unavailable}</div>;
    return (
      <PublicShell brand={brand} title="Form unavailable">
        {unavailable}
      </PublicShell>
    );
  }

  if (done) {
    const showBack = !suppressBackNav && (onboardingHref || onBackToForms);
    const backControl = showBack ? (
      onBackToForms ? (
        <button
          type="button"
          onClick={onBackToForms}
          className="mt-4 w-full rounded-lg border-2 py-2.5 text-sm font-semibold"
          style={{ borderColor: "var(--hr-brand-primary)", color: "var(--hr-brand-primary)" }}
        >
          ← Back to all forms
        </button>
      ) : onboardingHref ? (
        <Link
          href={onboardingHref}
          className="mt-4 inline-flex w-full items-center justify-center rounded-lg border-2 py-2.5 text-sm font-semibold"
          style={{ borderColor: "var(--hr-brand-primary)", color: "var(--hr-brand-primary)" }}
        >
          ← Back to all forms
        </Link>
      ) : null
    ) : null;

    const dashboardLink = dashboardHref ? (
      <Link
        href={dashboardHref}
        className={[
          "inline-flex w-full items-center justify-center rounded-lg py-2.5 text-sm font-semibold",
          showBack ? "mt-2 border-2" : "mt-4",
        ].join(" ")}
        style={
          showBack
            ? { borderColor: "var(--hr-brand-primary)", color: "var(--hr-brand-primary)" }
            : { background: "var(--hr-brand-primary)", color: "#fff" }
        }
      >
        ← My dashboard
      </Link>
    ) : null;

    if (embedded) {
      return (
        <div className="rounded-xl border border-[var(--success-line)] bg-[var(--success-wash)] p-4 text-sm text-[var(--success)]">
          <p className="font-semibold">{HR_FORM_TYPE_LABELS[formType]} submitted</p>
          <p className="mt-1 text-[var(--success)]">Choose another section in the bar above to continue.</p>
          {dashboardLink}
        </div>
      );
    }
    return (
      <PublicShell brand={brand} title="Thank you">
        <p className="text-sm text-slate-700">
          Your {HR_FORM_TYPE_LABELS[formType].toLowerCase()} has been received. HR will review and update your
          record.
        </p>
        {backControl}
        {dashboardLink}
      </PublicShell>
    );
  }

  const backLink =
    !suppressBackNav && embedded && (onboardingHref || onBackToForms) ? (
      onBackToForms ? (
        <button
          type="button"
          onClick={onBackToForms}
          className="mb-3 text-sm font-semibold text-slate-600 underline hover:text-slate-900"
        >
          ← Back to all forms
        </button>
      ) : onboardingHref ? (
        <Link
          href={onboardingHref}
          className="mb-3 inline-block text-sm font-semibold text-slate-600 underline hover:text-slate-900"
        >
          ← Back to all forms
        </Link>
      ) : null
    ) : null;

  const formBody = (
    <>
      {hrNote && !embedded ? (
        <p className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{hrNote}</p>
      ) : null}

      {canFillOnline && canUpload ? (
        <div className="mb-4 flex gap-2 rounded-lg bg-slate-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("online")}
            className={`flex-1 rounded-md py-2 font-medium ${mode === "online" ? "bg-white shadow text-slate-900" : "text-slate-600"}`}
          >
            Fill online
          </button>
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`flex-1 rounded-md py-2 font-medium ${mode === "upload" ? "bg-white shadow text-slate-900" : "text-slate-600"}`}
          >
            Upload signed PDF
          </button>
        </div>
      ) : (
        <p className="mb-4 text-xs text-slate-500">{HR_FORM_DELIVERY_LABELS[deliveryMode]}</p>
      )}

      {error ? (
        <p className="mb-3 rounded-md bg-[var(--danger-wash)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {mode === "online" && canFillOnline ? (
        <form onSubmit={handleOnlineSubmit} className="space-y-4">
          {formType === "BIODATA" ? <BiodataFormFields v={initialValues} /> : null}
          {formType === "BANK_FORM" ? <BankFields v={initialValues} /> : null}
          {formType === "GUARANTOR" ? <GuarantorFields v={initialValues} /> : null}
          {formType === "HEALTH" ? <HealthFields initialValues={initialValues} /> : null}
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--hr-brand-primary)" }}
          >
            {pending ? <ButtonSpinner /> : null}
            {pending ? "Submitting…" : "Submit form"}
          </button>
        </form>
      ) : null}

      {mode === "upload" && canUpload ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Download the blank form, fill and sign it, then upload a photo or PDF from your phone or computer.
          </p>
          <Link
            href={printPath}
            target="_blank"
            className="inline-flex w-full items-center justify-center rounded-lg border-2 py-2.5 text-sm font-semibold"
            style={{ borderColor: "var(--hr-brand-primary)", color: "var(--hr-brand-primary)" }}
          >
            Download / print blank form
          </Link>
          <label className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600 hover:bg-slate-100">
            <span className="font-semibold text-slate-800">
              {pending ? "Uploading…" : "Tap to upload signed form"}
            </span>
            <span className="mt-1 text-xs">PDF, JPG, or PNG</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={pending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      ) : null}

      {canFillOnline && mode === "upload" ? null : canUpload &&
        mode === "online" &&
        deliveryMode === "BOTH" ? (
        <p className="mt-4 text-center text-xs text-slate-500">
          Prefer paper? Switch to &quot;Upload signed PDF&quot; above.
        </p>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm" style={brandingCssVars(brand)}>
        {backLink}
        <BrandedDocumentShell
          brand={brand}
          title={HR_FORM_TYPE_LABELS[formType]}
          subtitle={`Hello${employeeName ? `, ${employeeName}` : ""}`}
        >
          {formBody}
        </BrandedDocumentShell>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4" style={brandingCssVars(brand)}>
      <div className="mx-auto max-w-lg">
        <BrandedDocumentShell
          brand={brand}
          title={HR_FORM_TYPE_LABELS[formType]}
          subtitle={`Hello${employeeName ? `, ${employeeName}` : ""}`}
        >
          {formBody}
        </BrandedDocumentShell>
      </div>
    </div>
  );
}

function PublicShell({
  brand,
  title,
  children,
}: {
  brand: TenantBranding;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4" style={brandingCssVars(brand)}>
      <div className="mx-auto max-w-md">
        <BrandedDocumentShell brand={brand} title={title}>
          {children}
        </BrandedDocumentShell>
      </div>
    </div>
  );
}

function BankFields({ v }: { v: InitialValues }) {
  const lockHolder = Boolean(v.accountHolderName?.trim() || v.fullName?.trim());
  const holder = v.accountHolderName || v.fullName || "";
  return (
    <>
      {lockHolder ? (
        <HrFormLockedField label="Account holder name" name="accountHolderName" value={holder} />
      ) : (
        <HrFormField
          label="Account holder name"
          name="accountHolderName"
          required
          defaultValue={v.accountHolderName}
        />
      )}
      <HrFormField label="Bank name" name="bankName" required defaultValue={v.bankName} />
      <HrFormField label="Bank address" name="bankAddress" defaultValue={v.bankAddress} />
      <HrLocationFields
        stateName="bankState"
        cityName="bankCity"
        stateDefault={v.bankState}
        cityDefault={v.bankCity}
      />
      <HrFormSelect
        label="Account type"
        name="accountType"
        required
        defaultValue={v.accountType}
        options={[
          { value: "Checking", label: "Checking" },
          { value: "Savings", label: "Savings" },
          { value: "Other", label: "Other" },
        ]}
      />
      <HrFormField label="Account number" name="accountNumber" required defaultValue={v.accountNumber} />
      <HrFormSelect
        label="Account for receiving payments"
        name="receivePayments"
        required
        options={[
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ]}
      />
    </>
  );
}

function GuarantorFields({ v }: { v: InitialValues }) {
  return (
    <>
      {v.employeeFullName?.trim() ? (
        <HrFormLockedField label="Employee full name" name="employeeFullName" value={v.employeeFullName} />
      ) : (
        <HrFormField
          label="Employee full name"
          name="employeeFullName"
          required
          defaultValue={v.employeeFullName}
        />
      )}
      {v.employeeJobTitle?.trim() ? (
        <HrFormLockedField label="Job title" name="employeeJobTitle" value={v.employeeJobTitle} />
      ) : (
        <HrFormField label="Job title" name="employeeJobTitle" defaultValue={v.employeeJobTitle} />
      )}
      <HrFormField
        label="Guarantor full name"
        name="guarantorFullName"
        required
        defaultValue={v.guarantorFullName}
      />
      <HrFormField label="Relationship" name="guarantorRelationship" defaultValue={v.guarantorRelationship} />
      <HrFormField label="Guarantor phone" name="guarantorPhone" type="tel" defaultValue={v.guarantorPhone} />
      <HrFormField
        label="Guarantor email"
        name="guarantorEmail"
        type="email"
        defaultValue={v.guarantorEmail}
      />
      <HrFormField label="Known employee for (years)" name="knownYears" defaultValue={v.knownYears} />
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" name="declarationAccepted" value="yes" required className="mt-1" />
        <span>I confirm the guarantor declaration for this employee.</span>
      </label>
    </>
  );
}

function HealthFields({ initialValues }: { initialValues?: InitialValues }) {
  const [hasMedical, setHasMedical] = useState(initialValues?.hasMedicalConditions === "yes");
  const [hasCerts, setHasCerts] = useState(initialValues?.hasCertifications === "yes");

  return (
    <>
      <HrFormSelect
        label="Any medical conditions or allergies?"
        name="hasMedicalConditions"
        required
        defaultValue={initialValues?.hasMedicalConditions || "no"}
        options={[
          { value: "no", label: "No" },
          { value: "yes", label: "Yes" },
        ]}
        onChange={(e) => setHasMedical(e.target.value === "yes")}
      />
      {hasMedical ? (
        <HrFormField
          label="If yes, please specify"
          name="medicalDetails"
          required
          defaultValue={initialValues?.medicalDetails}
        />
      ) : (
        <input type="hidden" name="medicalDetails" value="" />
      )}
      <HrFormSelect
        label="Certifications or special skills?"
        name="hasCertifications"
        required
        defaultValue={initialValues?.hasCertifications || "no"}
        options={[
          { value: "no", label: "No" },
          { value: "yes", label: "Yes" },
        ]}
        onChange={(e) => setHasCerts(e.target.value === "yes")}
      />
      {hasCerts ? (
        <HrTagsInput
          label="List them"
          name="certificationsList"
          required
          defaultValue={initialValues?.certificationsList}
          placeholder="e.g. Tailoring — press Enter after each"
          hint="Add each skill or certification as a tag (Enter or comma)."
        />
      ) : (
        <input type="hidden" name="certificationsList" value="" />
      )}
      <HrFormSelect
        label="Willing to join company training?"
        name="trainingWilling"
        required
        defaultValue={initialValues?.trainingWilling}
        options={[
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ]}
      />
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" name="declarationAccepted" value="yes" required className="mt-1" />
        <span>I declare that this information is accurate.</span>
      </label>
    </>
  );
}
